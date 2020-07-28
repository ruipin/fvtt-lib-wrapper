# FVTT Resilient Wrapper
Library module for Foundry VTT that provides a simple and resilient way to wrap methods.

> :warning: **This is an experimental library, and a work-in-progress! You probably shouldn't be using this at this moment.**


## Installation

### As a Module
1. Copy this link and use it in Foundry's Module Manager to install the Module

    > https://raw.githubusercontent.com/ruipin/fvtt-resilient-wrapper/master/module.json

2. Enable the Module in your World's Module Settings

### As a Library
1. Include the wrapper.js file in your project.

2. Load it in your manifest.json


## Usage

Using this library is very simple. All you need to do is to instantiate a `ResilientWrapper` instance, provide the object to override, as well as the property name.
It is highly recommended that you only hook methods after the 'ready' Hook fires:

```javascript
Hooks.once('ready', () => {
	new ResilientWrapper(SightLayer.prototype, 'updateToken', function (wrapped, ...args) {
		console.log('updateToken was called');

		return wrapped.apply(this, args);
	});
});
```