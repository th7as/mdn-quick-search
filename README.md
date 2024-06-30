# MDN Quick Search

## Features

Quickly search MDN docs and pick a page to open in external browser.

![Screenshot](https://raw.githubusercontent.com/th7as/mdn-quick-search/main/images/demo.png)

## Search Hints

This extension uses the QuickPick search and select box from VS Code, which has its own search and sort algorithm.
Currently it is **not** possible to customize these algorithms.

Word order is important when searching.
For example if you want to search for the `push` method from the `Array` object then you have to search like this: `array push`

Searching for `push array` will not succeed, because the MDN search index contains the words in the other order.

## Extension Settings

This extension contributes the following settings:

* `mdnQuickSearch.searchIndexUrl`: URL of the MDN search index json file.
