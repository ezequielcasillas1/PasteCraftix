export function getDemoCategories(now = Date.now()) {
  return [
    { id: now - 800000, name: '?? Code Snippets', icon: '??', createdAt: now - 800000, updatedAt: now - 800000 },
    { id: now - 700000, name: '?? Links & URLs', icon: '??', createdAt: now - 700000, updatedAt: now - 700000 },
    { id: now - 600000, name: '?? Email Templates', icon: '??', createdAt: now - 600000, updatedAt: now - 600000 },
    { id: now - 500000, name: '?? AI Prompts', icon: '??', createdAt: now - 500000, updatedAt: now - 500000 },
    { id: now - 400000, name: '?? Quick Reference', icon: '??', createdAt: now - 400000, updatedAt: now - 400000 },
    { id: now - 300000, name: '?? Math & Formulas', icon: '??', createdAt: now - 300000, updatedAt: now - 300000 },
    { id: now - 200000, name: '?? Diagrams & Charts', icon: '??', createdAt: now - 200000, updatedAt: now - 200000 },
    { id: now - 100000, name: '?? Notes & Docs', icon: '??', createdAt: now - 100000, updatedAt: now - 100000 }
  ];
}

export function getDemoClips(now = Date.now()) {
  return [
    // -- 4 MARKUP DEMO CLIPS (showcase rendering capabilities) --
    { id: 'demo_markup_1', text: '\\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}\n\n\\int_{0}^{\\infty} e^{-x^2} dx = \\frac{\\sqrt{\\pi}}{2}', category: '?? Math & Formulas', timestamp: now - 800000, meta: { markupHint: 'latex' } },
    { id: 'demo_markup_2', text: 'graph TD\n  A[Start] --> B{Decision}\n  B -->|Yes| C[Process]\n  B -->|No| D[End]\n  C --> D', category: '?? Diagrams & Charts', timestamp: now - 700000, meta: { markupHint: 'mermaid' } },
    { id: 'demo_markup_3', text: 'async function fetchJSON(url) {\n  try {\n    const res = await fetch(url);\n    if (!res.ok) throw new Error(res.statusText);\n    return await res.json();\n  } catch (err) {\n    console.error("Fetch failed:", err);\n    return null;\n  }\n}', category: '?? Code Snippets', timestamp: now - 600000, meta: { markupHint: 'javascript' } },
    { id: 'demo_markup_4', text: '# Quick Notes\n\n## Today\'s Tasks\n- [ ] Review pull request\n- [x] Update dependencies\n- [ ] Write unit tests\n\n> **Tip:** PasteCraft auto-detects markup like Markdown, LaTeX, and code.\n\nDelete these examples anytime — they\'re just here to show what\'s possible!', category: '?? Notes & Docs', timestamp: now - 500000, meta: { markupHint: 'markdown' } },
    // -- 4 COMMON CLIPBOARD CLIPS (research-backed presets) --
    { id: 'demo_common_1', text: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript\nhttps://stackoverflow.com/questions\nhttps://github.com/trending', category: '?? Links & URLs', timestamp: now - 400000 },
    { id: 'demo_common_2', text: 'Hi [Name],\n\nThank you for reaching out. I wanted to follow up regarding [topic].\n\nPlease let me know if you have any questions.\n\nBest regards,\n[Your Name]', category: '?? Email Templates', timestamp: now - 300000 },
    { id: 'demo_common_3', text: 'Act as an expert [role]. I need you to [task]. The context is [context]. Format your response as [format]. Keep it concise and actionable.', category: '?? AI Prompts', timestamp: now - 200000 },
    { id: 'demo_common_4', text: 'Company: PasteCraft Inc.\nSupport: support@pastecraft.com\nDocs: https://pastecraft.com/docs\nVersion: 1.0.0', category: '?? Quick Reference', timestamp: now - 100000 }
  ];
}
