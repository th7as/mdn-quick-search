import { Disposable, ExtensionContext, QuickPickItem, Range, TextEditor, Uri, commands, env, window, workspace } from 'vscode';
import { ProxyAgent } from 'proxy-agent';
import fetch from 'node-fetch';

interface SearchIndexItem {
    title: string;
    url: string;
}

interface SearchIndexPickItem extends QuickPickItem {
    url: string;
}

let searchIndexUrl = '';
let searchIndex: SearchIndexPickItem[] | undefined;

/**
 * Activates the Extension.
 *
 * @param context - Extension context
 */
export function activate(context: ExtensionContext): void {
    const config = workspace.getConfiguration('mdnQuickSearch');
    searchIndexUrl = config.get('searchIndexUrl', 'https://developer.mozilla.org/en-US/search-index.json');

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
                })
            );

            quickPick.value = searchText;
            quickPick.show();

            if (!searchIndex) {
                quickPick.enabled = false;
                quickPick.busy = true;

                fetchSearchIndex()
                    .then((index) => {
                        searchIndex = prepareSearchIndex(index);
                        quickPick.busy = false;
                        quickPick.enabled = true;
                        quickPick.items = searchText.trim().length > 1 ? searchIndex : [];
                    })
                    .catch(() => {
                        window.showErrorMessage(`Error loading ${searchIndexUrl}`);
                        resolve(undefined);
                        quickPick.dispose();
                    });
            }
        });
    } finally {
        disposables.forEach((d) => d.dispose());
    }
}

/**
 * Loads the MDN search index.
 *
 * @returns MDN search index
 */
async function fetchSearchIndex(): Promise<SearchIndexItem[]> {
    try {
        const proxyAgent = new ProxyAgent();
        const response = await fetch(searchIndexUrl, { agent: proxyAgent });

        if (response.ok) {
            return response.json() as Promise<SearchIndexItem[]>;
        } else {
            console.error(`HTTP Error: ${response.status} - ${response.statusText}`);
        }
    } catch (error) {
        console.error(error);
    }

    throw new Error();
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
