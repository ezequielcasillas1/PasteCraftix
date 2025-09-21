// PasteCraft Type Definitions
export interface Capture {
    text: string;
    timestamp: string;
    url: string;
    title: string;
}

export interface Preferences {
    historySize?: number;
    delimiter?: string;
    deduplicate?: boolean;
    sort?: boolean;
    caseTransform?: string;
}

export interface ExtensionMessage {
    type: 'GET_CAPTURES' | 'SAVE_PREFERENCES' | 'CLEAR_CAPTURES';
    data?: any;
}
