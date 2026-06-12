# 🚀 Ventarys Desktop v1.0.2

## ✨ What's New

### 🖥️ Full IDE Transformation

- **Complete IDE Interface** — Transformed into a fully functional IDE similar to Claude Code and OpenAI Codex
- **Dark Theme Default** — Entire UI uses a professional dark theme with GitHub Dark inspired colors
- **Monochromatic Design** — Clean unified dark color scheme for a professional look

### 📁 New Sidebar Views

- **Search Tab** — Full file search with:
  - Real-time file content search across entire folder tree
  - Case-sensitive search option
  - Regex search support
  - Whole word matching option
  - Click-to-navigate to search results
  - Results display with file path and line numbers

- **Git Tab** — Integrated Git operations:
  - Git status visualization with color-coded changes
  - Commit message input with keyboard shortcuts
  - Color-coded file status (Added=Green, Modified=Yellow, Deleted=Red)
  - One-click commit functionality

### 🔄 Enhanced AI Features

- **Auto Retry (5 attempts)** — Increased API retry attempts from 3 to 5 for better reliability
- **Auto Reload** — Automatic file content sync when AI modifies files
- **Accept/Reject Changes** — Banner notification when AI detects file changes with:
  - Accept button to apply AI changes
  - Reject button to discard AI changes
  - Auto-accept after 2 seconds (configurable)
- **Auto Accept Toggle** — Enable/disable auto-accept from AI menu

### 📋 New Menu System

- **File Menu** — Open Folder, Save File (Ctrl+S), Save All, Close File
- **Edit Menu** — Undo, Redo, Find (Ctrl+F), Select All
- **View Menu** — Toggle Sidebar/Terminal/AI Panel, Font Size controls, Markdown Preview, Fullscreen
- **AI Menu** — Auto Retry status, Auto Reload toggle, Auto Accept toggle, Export Chat
- **Tools Menu** — Git Status, Git Commit, Clear Terminal
- **Settings Menu** — Settings, About

### 📝 Markdown Preview

- **Full Markdown Preview Modal** — Preview markdown content in a dedicated modal
- **Supported Content** — Full markdown rendering with code highlighting
- **Access via View Menu** — Toggle from View > Markdown Preview

### 💬 Chat Enhancements

- **Export Chat** — Export conversation history as markdown file
- **Chat Export Format** — Clean markdown format with User/Agent labels

### 🎨 UI Improvements

- **About Modal** — Information dialog with version and features
- **Enhanced Terminal** — Terminal panel with clear and close buttons
- **Resizable Panels** — All panels (sidebar, chat, terminal) are resizable
- **Context Usage Indicator** — Real-time context window usage progress bar

### 🐛 Bug Fixes

- Fixed auto-retry indicator showing correct retry count (1/5)
- Fixed settings modal dark theme styling
- Fixed search input dark theme styling

### 🔧 Technical

- Added file search with regex support using `escapeRegex` utility
- Added HTML escaping utility for safe display
- Added localStorage persistence for auto-reload settings
- Added goToSearchResult window function for click navigation
- Improved tab switching for all sidebar views
- Enhanced git command execution with proper error handling

## 📋 Changelog

### Changed

- Increased MAX_RETRIES from 3 to 5
- Auto reload setting now persists to localStorage
- Complete dark theme overhaul

### Added

- Search functionality with case-sensitive, regex, whole-word options
- Git status and commit integration
- Full menu system with 6 menus
- Markdown preview modal
- About modal
- Chat export functionality
- Font size increase/decrease controls
- Fullscreen toggle

---

**Version**: 1.0.2
**Release Date**: 2026-06-11
**Previous Version**: 1.0.1
