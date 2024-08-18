# MDN Quick Search

## Features

Quickly search MDN docs and pick a page from the search results to open in external browser.

![Screenshot](https://raw.githubusercontent.com/th7as/mdn-quick-search/main/images/demo.png)

## Commands

This extension contributes the following command:

* `mdnQuickSearch.search`: Opens MDN Quick Search. Selected text in the active editor will be used as the default search text.
    If no text is selected, then the text at the cursor positon will be used.

## Settings

This extension contributes the following settings:

* `mdnQuickSearch.searchIndexUrl`: URL of the MDN search index json file.
* `mdnQuickSearch.alwaysUseBuiltInSearchIndex`: If enabled then always uses the built-in search index,
    otherwise the newest search index is loaded from `mdnQuickSearch.searchIndexUrl` and the built-in one is used only in case of failure.

## Search Hints

This extension uses the QuickPick search and select box from VS Code, which has its own search and sort algorithm.
Currently it is **not** possible to customize these algorithms.

Word order is important when searching.
For example if you want to search for the `push` method from the `Array` object then you have to search for `array push`.

Searching for `push array` will not succeed, because the MDN search index contains the words in the other order.
