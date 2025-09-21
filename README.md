# PasteCraft

Organize, format, and paste copied content effortlessly. Turn any text selection into organized, formatted content with just a keyboard shortcut.

## 🚀 Features

- **Text Capture**: Select text on any webpage and press `Alt+Shift+C` to capture
- **Smart Formatting**: Choose from comma, newline, space, or custom delimiters
- **Text Processing**: Deduplicate, sort alphabetically, and transform case
- **Visual Dashboard**: Modern React interface for managing captured content
- **Browser Extension**: Chrome/Edge extension with popup interface
- **Real-time Preview**: See formatted output before copying

## 🏗️ Architecture

### Frontend Dashboard (`pastecraft.client`)
- **React 19** with TypeScript
- **Vite** for fast development and building
- **Modern CSS** with custom properties and responsive design
- **Professional UI** with card-based layouts and smooth animations

### Browser Extension
- **Manifest V3** Chrome extension
- **Background service worker** for text capture
- **Popup interface** for quick formatting
- **Chrome storage** for persistence

### Backend API (`PasteCraft.Server`)
- **ASP.NET Core 8.0** web API
- **OpenAPI/Swagger** documentation
- **SPA proxy** integration

## 🛠️ Development Setup

### Prerequisites
- Node.js 18+
- .NET 8.0 SDK
- Chrome/Edge browser for extension testing

### Frontend Development
```bash
cd pastecraft.client
npm install
npm run dev
```

### Backend Development
```bash
cd PasteCraft.Server
dotnet run
```

### Extension Testing
1. Open Chrome/Edge
2. Navigate to `chrome://extensions/`
3. Enable "Developer mode"
4. Click "Load unpacked" and select the project root directory
5. Use `Alt+Shift+C` to capture text from any webpage

## 🎨 UI Design Principles

Following modern design standards with:
- **Clean, minimal interface** with strong visual hierarchy
- **Card-based sections** with rounded corners and soft shadows
- **Vibrant gradients** and smooth animations
- **Professional typography** using Inter font
- **Responsive grid layouts** for all screen sizes
- **Intuitive interactions** with clear visual feedback

## 📁 Project Structure

```
PasteCraft/
├── pastecraft.client/          # React frontend dashboard
│   ├── src/
│   │   ├── App.tsx            # Main dashboard component
│   │   ├── App.css            # Dashboard styling
│   │   ├── types.ts           # TypeScript interfaces
│   │   └── main.tsx           # React entry point
│   └── package.json
├── PasteCraft.Server/          # ASP.NET Core backend
│   ├── Program.cs             # API server
│   └── PasteCraft.Server.csproj
├── extension/                  # Browser extension assets
├── popup.html                  # Extension popup interface
├── background.js               # Service worker
├── manifest.json              # Extension manifest
└── styles/popup.css           # Extension styling
```

## 🔧 Extension Features

- **Keyboard Shortcut**: `Alt+Shift+C` captures selected text
- **Smart Storage**: Configurable history size with automatic cleanup
- **Cross-tab Sync**: Captures available across all browser tabs
- **Visual Feedback**: Notifications and popup interface
- **Format Controls**: Real-time text transformation options

## 🎯 Usage

1. **Capture Text**: Select any text on a webpage and press `Alt+Shift+C`
2. **Open Dashboard**: Click the extension icon or visit the web dashboard
3. **Select Captures**: Click on captured text cards to include in output
4. **Choose Format**: Select delimiter and transformation options
5. **Copy Result**: Click "Copy Crafted Output" to get formatted text

## 🚧 Development Status

- ✅ Frontend dashboard components complete
- ✅ Extension popup interface functional
- ✅ Text capture and storage working
- ✅ Format controls and preview system
- 🔄 Backend API integration (in progress)
- 🔄 Advanced formatting options
- 🔄 Export/import functionality

## 📄 License

MIT License - see LICENSE file for details

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes following the established patterns
4. Test thoroughly
5. Submit a pull request

Built with ❤️ for productivity enthusiasts
