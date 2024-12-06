import { Disposable, ExtensionContext, QuickPick, QuickPickItem, Range, TextEditor, ThemeIcon, Uri, commands, env, window, workspace } from 'vscode';
import { xhr, XHRResponse, getErrorStatusDescription } from 'request-light';

interface SearchIndexItem {
    title: string;
    url: string;
}

interface SearchIndexPickItem extends QuickPickItem {
    url: string;
}

let searchIndex: SearchIndexPickItem[] | undefined;

/**
 * Activates the Extension.
 *
 * @param context - Extension context
 */
export function activate(context: ExtensionContext): void {
    const searchCommand = commands.registerCommand('mdnQuickSearch.search', async () => {
        let searchText = '';

        const editor = window.activeTextEditor;
        if (editor) {
            if (editor.selection.isEmpty) {
                searchText = getSearchTextFromCursorPos(editor);
            } else if (editor.selection.isSingleLine) {
                searchText = editor.document.getText(editor.selection);
            }
        }

        const itemUrl = await pickSearchIndexItem(searchText);
        if (itemUrl) {
            env.openExternal(Uri.parse(`https://developer.mozilla.org${itemUrl}`));
        }
    });

    context.subscriptions.push(searchCommand);
}

/**
 * Gets the default search text from the cursor position.
 *
 * @param editor - Active text editor
 *
 * @returns Search Text
 */
function getSearchTextFromCursorPos(editor: TextEditor): string {
    let searchText = '';

    const wordRange = editor.document.getWordRangeAtPosition(editor.selection.active);
    if (wordRange) {
        searchText = editor.document.getText(wordRange);

        const n = wordRange.start.character + searchText.length;
        if (editor.document.getText(new Range(wordRange.start.line, n, wordRange.start.line, n + 1)) === '(') {
            searchText += '(';
        }
    }

    return searchText;
}

/**
 * Lets the user pick an item from the search index.
 *
 * @param searchText - Initial search text
 *
 * @returns - Relative URL of the picked item
 */
async function pickSearchIndexItem(searchText: string): Promise<string | undefined> {
    const disposables: Disposable[] = [];

    try {
        return await new Promise<string | undefined>((resolve) => {
            const quickPick = window.createQuickPick<SearchIndexPickItem>();
            quickPick.title = 'MDN Quick Search';
            quickPick.placeholder = 'Type to search';

            disposables.push(
                quickPick.onDidChangeValue((value) => {
                    if (value.trim().length > 1 && searchIndex) {
                        if (quickPick.items !== searchIndex) {
                            quickPick.items = searchIndex;
                        }
                    } else if (quickPick.items.length > 0) {
                        quickPick.items = [];
                    }
                }),
                quickPick.onDidChangeSelection((items) => {
                    if (items.length > 0) {
                        resolve(items[0].url);
                        quickPick.dispose();
                    }
                }),
                quickPick.onDidHide(() => {
                    resolve(undefined);
                    quickPick.dispose();
                }),
                quickPick.onDidTriggerButton(() => {
                    let searchTerm = quickPick.value.trim();
                    if (searchTerm.length > 1) {
                        if (searchTerm.slice(-1) === '(') {
                            searchTerm = searchTerm.substring(0, searchTerm.length - 1);
                        }
                        const config = workspace.getConfiguration('mdnQuickSearch');
                        const searchQueryUrl = config.get<string>('searchQueryUrl', 'https://developer.mozilla.org/en-US/search?q=');
                        env.openExternal(Uri.parse(searchQueryUrl + encodeURIComponent(searchTerm)));
                        resolve(undefined);
                        quickPick.dispose();
                    }
                })
            );

            quickPick.buttons = [
                {
                    iconPath: new ThemeIcon('search'),
                    tooltip: 'Search at MDN site',
                },
            ];
            quickPick.value = searchText;
            quickPick.show();

            if (!searchIndex) {
                quickPick.enabled = false;
                quickPick.busy = true;

                const config = workspace.getConfiguration('mdnQuickSearch');
                const alwaysUseBuiltInSearchIndex = config.get<boolean>('alwaysUseBuiltInSearchIndex', false);

                if (alwaysUseBuiltInSearchIndex) {
                    setSearchIndex(quickPick, searchText, require('./search-index.json'));
                } else {
                    const searchIndexUrl = config.get<string>('searchIndexUrl', 'https://developer.mozilla.org/en-US/search-index.json');
                    const headers = { 'Accept-Encoding': 'gzip, deflate' };

                    xhr({ url: searchIndexUrl, followRedirects: 5, headers }).then(
                        (response) => {
                            setSearchIndex(quickPick, searchText, JSON.parse(response.responseText));
                        },
                        (error: XHRResponse) => {
                            console.error(error.responseText || getErrorStatusDescription(error.status) || error.toString());
                            setSearchIndex(quickPick, searchText, require('./search-index.json'));
                        }
                    );
                }
            }
        });
    } finally {
        disposables.forEach((d) => d.dispose());
    }
}

/**
 * Sets the MDN search index for use in QuickPick.
 *
 * @param quickPick - QuickPick
 * @param searchText - Initial search text
 * @param index - MDN search index
 */
function setSearchIndex(quickPick: QuickPick<SearchIndexPickItem>, searchText: string, index: SearchIndexItem[]): void {
    searchIndex = prepareSearchIndex(index);

    quickPick.busy = false;
    quickPick.enabled = true;
    quickPick.items = searchText.trim().length > 1 ? searchIndex : [];
}

/**
 * Prepares the MDN search index for use in QuickPick.
 *
 * @param index - MDN search index
 *
 * @returns Search index prepared for QuickPick
 */
function prepareSearchIndex(index: SearchIndexItem[]): SearchIndexPickItem[] {
    let start = 0;

    if (index.length > 0) {
        const pos = index[0].url.indexOf('/docs/');
        if (pos >= 0) {
            start = pos + 6;
        }
    }

    return index.map((item) => {
        return {
            label: item.title.replaceAll('.', ' .'),
            url: item.url,
            description: item.url.substring(start).replaceAll('/', ' / '),
        };
    });
}
