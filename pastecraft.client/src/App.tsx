import { useEffect, useState } from 'react';
import './App.css';
import type { Capture, Preferences } from './types';

function App() {
    const [captures, setCaptures] = useState<Capture[]>([]);
    const [, setPreferences] = useState<Preferences>({});
    const [selectedCaptures, setSelectedCaptures] = useState<Set<number>>(new Set());
    const [formattedOutput, setFormattedOutput] = useState('');
    const [delimiter, setDelimiter] = useState('comma');
    const [deduplicate, setDeduplicate] = useState(false);
    const [sort, setSort] = useState(false);
    const [caseTransform, setCaseTransform] = useState('none');

    useEffect(() => {
        loadData();
    }, []);

    useEffect(() => {
        generateOutput();
    }, [selectedCaptures, delimiter, deduplicate, sort, caseTransform]);

    const loadData = async () => {
        try {
            // Simulate chrome.storage for web testing
            const mockData = {
                captures: [
                    {
                        text: "Sample captured text from webpage",
                        timestamp: new Date().toISOString(),
                        url: "https://example.com",
                        title: "Example Page"
                    },
                    {
                        text: "Another text selection",
                        timestamp: new Date(Date.now() - 3600000).toISOString(),
                        url: "https://github.com",
                        title: "GitHub"
                    }
                ],
                preferences: {
                    historySize: 500,
                    delimiter: 'comma'
                }
            };
            setCaptures(mockData.captures);
            setPreferences(mockData.preferences);
        } catch (error) {
            console.error('Failed to load data:', error);
        }
    };

    const generateOutput = () => {
        const selectedTexts = Array.from(selectedCaptures)
            .map(index => captures[index]?.text)
            .filter(Boolean);

        if (selectedTexts.length === 0) {
            setFormattedOutput('');
            return;
        }

        let processedTexts = [...selectedTexts];

        // Apply transformations
        if (deduplicate) {
            processedTexts = [...new Set(processedTexts)];
        }

        if (sort) {
            processedTexts.sort();
        }

        if (caseTransform === 'upper') {
            processedTexts = processedTexts.map(t => t.toUpperCase());
        } else if (caseTransform === 'lower') {
            processedTexts = processedTexts.map(t => t.toLowerCase());
        }

        // Apply delimiter
        const delimiters = {
            comma: ', ',
            newline: '\n',
            space: ' ',
            custom: ' | '
        };

        const output = processedTexts.join(delimiters[delimiter as keyof typeof delimiters] || ', ');
        setFormattedOutput(output);
    };

    const toggleCapture = (index: number) => {
        const newSelected = new Set(selectedCaptures);
        if (newSelected.has(index)) {
            newSelected.delete(index);
        } else {
            newSelected.add(index);
        }
        setSelectedCaptures(newSelected);
    };

    const copyToClipboard = async () => {
        try {
            await navigator.clipboard.writeText(formattedOutput);
            // Visual feedback could be added here
        } catch (error) {
            console.error('Failed to copy:', error);
        }
    };

    return (
        <div className="pastecraft-dashboard">
            <header className="dashboard-header">
                <div className="logo-section">
                    <h1>PasteCraft Dashboard</h1>
                    <p>Organize and format your captured text</p>
                </div>
            </header>

            <main className="dashboard-main">
                <section className="captures-section">
                    <h2>Captured Text ({captures.length})</h2>
                    <div className="captures-grid">
                        {captures.length === 0 ? (
                            <div className="empty-state">
                                <p>No captures yet. Use Alt+Shift+C to capture text from any webpage.</p>
                            </div>
                        ) : (
                            captures.map((capture, index) => (
                                <div 
                                    key={index}
                                    className={`capture-card ${selectedCaptures.has(index) ? 'selected' : ''}`}
                                    onClick={() => toggleCapture(index)}
                                >
                                    <div className="capture-text">{capture.text}</div>
                                    <div className="capture-meta">
                                        <span className="capture-source">{capture.title}</span>
                                        <span className="capture-time">
                                            {new Date(capture.timestamp).toLocaleString()}
                                        </span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </section>

                <section className="format-section">
                    <h2>Format Controls</h2>
                    <div className="format-controls">
                        <div className="delimiter-controls">
                            <label>Delimiter:</label>
                            <div className="button-group">
                                {['comma', 'newline', 'space', 'custom'].map(del => (
                                    <button
                                        key={del}
                                        className={`format-btn ${delimiter === del ? 'active' : ''}`}
                                        onClick={() => setDelimiter(del)}
                                    >
                                        {del.charAt(0).toUpperCase() + del.slice(1)}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="transform-controls">
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={deduplicate}
                                    onChange={(e) => setDeduplicate(e.target.checked)}
                                />
                                <span>Deduplicate</span>
                            </label>
                            <label className="toggle">
                                <input
                                    type="checkbox"
                                    checked={sort}
                                    onChange={(e) => setSort(e.target.checked)}
                                />
                                <span>Sort A→Z</span>
                            </label>
                            <select
                                value={caseTransform}
                                onChange={(e) => setCaseTransform(e.target.value)}
                                className="case-select"
                            >
                                <option value="none">Original Case</option>
                                <option value="upper">UPPERCASE</option>
                                <option value="lower">lowercase</option>
                            </select>
                        </div>
                    </div>
                </section>

                <section className="preview-section">
                    <h2>Formatted Output</h2>
                    <div className="preview-container">
                        <textarea
                            className="preview-textarea"
                            value={formattedOutput}
                            readOnly
                            placeholder="Select captures above to see formatted output..."
                        />
                        <button
                            className="copy-btn"
                            onClick={copyToClipboard}
                            disabled={!formattedOutput}
                        >
                            Copy Crafted Output
                        </button>
                    </div>
                </section>
            </main>
        </div>
    );
}

export default App;