# Collection Cluster
[![Collection Cluster on NPM](https://img.shields.io/npm/v/@codetasty/collection-cluster.svg)](https://www.npmjs.com/package/@codetasty/collection-cluster) 

Vanilla JS library for displaying large data sets easily with great performance.

## Install
`$ npm install @codetasty/collection-cluster --save`

## Usage
```html
<ul class="list"></ul>
```

```javascript
var data = ['Item 1', 'Item 2', 'Item 3'];

var collection = new CollectionCluster.Collection(document.querySelector('.list'), {
	size: {
		height: 30,
	},
	getLength: function() {
		return data.length;
	},
	cellForIndex: function(collection, index) {
		let cell = collection.dequeueReusableCell('custom');
		cell.el.textContent = data[index];
		
		return cell;
	}
});

collection.registerCell('custom', CollectionCluster.Cell);

collection.hook();
```

## Usage