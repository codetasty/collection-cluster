(function() {
	class Cell {
		constructor(tagName) {
			this.el = document.createElement(tagName);
			
			this.isReusable = true;
		}
		
		prepareForReuse() {
			
		}
		
		prepareForDelete() {
			
		}
	}
	
	Cell.identifier = null;
	
	class Collection {
		/**
		 * Options:
		 * - [columns] {integer}
		 * - size {object(width, height)}
		 * - [inset] {object(top, bottom)}
		 * - [scrollPastEnd] {integer}
		 */
		constructor(el, options) {
			options = options || {};
			
			this.el = el;
			
			//options
			this.columns = options.columns || 1;
			this.size = {
				width: options.size ? options.size.width || null : null,
				height: options.size ? options.size.height : 30,
			};
			this.inset = {
				top: options.inset ? options.inset.top || 0 : 0,
				bottom: options.inset ? options.inset.bottom || 0 : 0,
			};
			this.scrollPastEnd = options.scrollPastEnd || 0;
			
			//state
			this.currentStart = 0;
			this.currentEnd = 0;
			this.top = 0;
			this.treshold = 100;
			this.height = this.el.clientHeight;
			this.hooked = false;
			
			//data
			this.length = 0;
			this.isBatchUpdate = false;
			
			//cells
			this.cellTagName = options.cellTagName || 'li';
			this.cells = {};
			this.visibleCells = [];
			this.startCell = document.createElement(this.cellTagName);
			this.endCell = document.createElement(this.cellTagName);
			
			//delegates
			this.dataSource = {
				getLength: options.getLength,
				cellForIndex: options.cellForIndex
			};
		}
		
		get start() {
			let y = this.top - this.treshold;
			y = y < 0 ? 0 : y;
			
			let index = Math.floor(y / this.size.height) * this.columns;
			
			if (index > this.length) {
				index = this.length;
			}
			
			return index;
		}
		
		get end() {
			let index = Math.ceil((this.top + this.height + this.treshold) / this.size.height) * this.columns;
			
			if (index > this.length) {
				index = this.length;
			}
			
			return index;
		}
		
		get visibleCellsCount() {
			return Math.ceil((this.height + this.treshold) / this.size.height) + 1; //add +1 for overlap
		}
		
		get scrollPastEndSize() {
			let size = this.scrollPastEnd * this.height;
			
			size -= this.inset.top + this.inset.bottom + this.size.height;
			
			return size < 0 ? 0 : size;
		}
		
		cellForIndex(index) {
			return this.visibleCells[index - this.currentStart];
		}
		
		hook() {
			if (this.hooked) {
				return console.warn('Collection already hooked.');
			}
			
			this.hooked = true;
			
			//setup length and top position
			this.length = this.dataSource.getLength(this);
			this.top = this.el.scrollTop;
			
			this.el.appendChild(this.startCell);
			this.el.appendChild(this.endCell);
			
			//update cells
			this.update();
			
			//bind events
			this.el.addEventListener('scroll', () => {
				this.top = this.el.scrollTop;
				
				this.update();
			});
		}
		
		update() {
			let start = this.start;
			let end = this.end;
			let i;
			let cell;
			let fragment;
			
			//delete cells at the benning
			let deleteEnd = start < this.currentEnd ? start : this.currentEnd;
			
			for (i = this.currentStart; i < deleteEnd; i++) {
				cell = this.visibleCells.shift();
				cell.prepareForDelete();
				this.el.removeChild(cell.el);
				
				// add cell to reusable list
				this.reuseCell(cell);
			}
			
			//detele cells at the end
			let deleteStart = end > this.currentStart ? end : this.currentStart;
			
			for (i = deleteStart; i < this.currentEnd; i++) {
				cell = this.visibleCells.pop();
				cell.prepareForDelete();
				this.el.removeChild(cell.el);
				
				// add cell to reusable list
				this.reuseCell(cell);
			}
			
			//insert from at the beginning
			let insertTo = end < this.currentStart ? end : this.currentStart;
			
			if (insertTo > start) {
				fragment = document.createDocumentFragment();
				
				//temporary array for added cells
				let cells = [];
				
				for (i = start; i < insertTo; i++) {
					cell = this.dataSource.cellForIndex(this, i);
					//add cell to temporary array so it's sorted correctly, as we go backwards
					cells.push(cell);
					
					fragment.appendChild(cell.el);
				}
				
				if (this.visibleCells.length) {
					this.el.insertBefore(fragment, this.visibleCells[0].el);
					this.visibleCells.unshift(...cells);
				} else {
					this.el.insertBefore(fragment, this.endCell);
					this.visibleCells = cells;
				}
			}
			
			//insert from at the end
			let insertFrom = start > this.currentEnd ? start : this.currentEnd;
			
			if (insertFrom < end) {
				fragment = document.createDocumentFragment();
				
				for (i = insertFrom; i < end; i++) {
					cell = this.dataSource.cellForIndex(this, i);
					this.visibleCells.push(cell);
					
					fragment.appendChild(cell.el);
				}
				
				this.el.insertBefore(fragment, this.endCell);
			}
			
			this.currentStart = start;
			this.currentEnd = end;
			
			this.startCell.style.height = (
				this.inset.top +
				((this.currentStart / this.columns) * this.size.height)
			) + 'px';
			this.endCell.style.height = (
				this.inset.bottom + this.scrollPastEndSize +
				(Math.ceil((this.length - this.currentEnd) / this.columns) * this.size.height)
			) + 'px';
		}
		
		resize() {
			this.height = this.el.clientHeight;
			this.update();
		}
		
		/**
		 * Data
		 */
		reload() {
			for (let i = 0; i < this.visibleCells.length; i++) {
				this.visibleCells[i].prepareForDelete();
				this.el.removeChild(this.visibleCells[i].el);
			}
			
			this.visibleCells = [];
			this.currentStart = 0;
			this.currentEnd = 0;
			this.length = this.dataSource.getLength(this);
			
			this.update();
		}
		
		insert(index, length) {
			this.length += length;
			
			//if insert is before visible area, just move indexes and update
			if (index < this.currentStart) {
				this.currentStart += length;
				this.currentEnd += length;
				
				!this.isBatchUpdate && this.update();
				return;
			//if insert is after visible area, just update
			//if equals, might reach end
			} else if (index > this.currentEnd) {
				!this.isBatchUpdate && this.update();
				return;
			}
			
			//current visible max
			let curentVisibleMax = this.visibleCells.length - (index - this.currentStart);
			
			let startIndex = index - this.currentStart;
			//max visible cells without threshold
			let visibleMax = this.visibleCellsCount - startIndex;
			
			let renderLength = Math.min(Math.max(curentVisibleMax, visibleMax), length);
			let end = index + renderLength;
			
			//if not cells should be rendered, just update
			if (renderLength < 1) {
				!this.isBatchUpdate && this.update();
				return;
			}
			
			let cells = [];
			let fragment = document.createDocumentFragment();
			
			for (let i = index; i < end; i++) {
				let cell = this.dataSource.cellForIndex(this, i);
				cells.push(cell);
				
				fragment.appendChild(cell.el);
			}
			
			this.visibleCells.splice(startIndex, 0, ...cells);
			this.currentEnd += cells.length;
			
			let beforeCell = this.visibleCells[startIndex + cells.length];
			
			this.el.insertBefore(fragment, beforeCell ? beforeCell.el : this.endCell);
			
			//remove unnecessary cells
			!this.isBatchUpdate && this.update();
		}
		
		delete(index, length) {
			this.length -= length;
			
			//if delete is before visible area, just move indexes and update
			if (index + length < this.currentStart) {
				this.currentStart -= length;
				this.currentEnd -= length;
				
				!this.isBatchUpdate && this.update();
				return;
			//if delete is after visible area, just update
			} else if (index >= this.currentEnd) {
				!this.isBatchUpdate && this.update();
				return;
			}
			
			let startIndex = index - this.currentStart;
			let deleteLength = length;
			if (startIndex < 0) {
				deleteLength += startIndex;
				startIndex = 0;
			}
			
			let cells = this.visibleCells.splice(startIndex, deleteLength);
			
			if (startIndex === 0) {
				this.currentStart += deleteLength;
			}
			
			this.currentEnd = this.currentStart + this.visibleCells.length;
			
			for (let i = 0; i < cells.length; i++) {
				cells[i].prepareForDelete();
				this.el.removeChild(cells[i].el);
				
				//add cell to reusable list
				this.reuseCell(cells[i]);
			}
			
			//insert new cells
			!this.isBatchUpdate && this.update();
		}
		
		deleteInsert(index, length, insert) {
			this.batch(function() {
				this.delete(index, length);
				this.insert(index, insert);
			});
		}
		
		batch(fn) {
			this.isBatchUpdate = true;
			
			fn.call(this);
			
			this.isBatchUpdate = false;
			this.update();
		}
		
		/**
		 * Cells
		 */
		registerCell(name, cell) {
			if (!cell) {
				cell = name;
				name = 'default';
			}
			
			if (this.cells[name]) {
				return console.warn('Cell already registered.');
			}
			
			this.cells[name] = {
				cell: cell,
				reusable: []
			};
		}
		
		dequeueReusableCell(identifier) {
			identifier = identifier || 'default';
			let registered = this.cells[identifier];
			
			if (!registered) {
				throw new Error(`No cell with identifier "${identifier}" registered.`);
			}
			
			let cell;
			
			if (registered.reusable.length) {
				cell = registered.reusable.shift();
				cell.prepareForReuse();
			} else {
				cell = new registered.cell(this.cellTagName);
				cell.el.style.height = this.size.height + 'px';
			}
			
			return cell;
		}
		
		reuseCell(cell) {
			if (cell.isReusable && this.cells[cell.constructor.identifier].reusable.length < 10) {
				this.cells[cell.constructor.identifier].reusable.push(cell);
			}
		}
	}
	
	if (typeof define === 'function' && define.amd) {
		define(function(require, exports, module) {
			exports.Collection = Collection;
			exports.Cell = Cell;
		});
	} else {
		window.CollectionCluster = {
			Collection: Collection,
			Cell: Cell,
		};
	}
}());