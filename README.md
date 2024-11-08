# Ubuntu Management Application

A desktop application built with Electron for managing Ubuntu systems remotely. This application enables remote system management through WebSocket connections, allowing administrators to execute commands, install software, and manage system settings.

## Features

- Remote command execution
- Automated software installation with desktop shortcut creation
- Wallpaper management
- System tracking and monitoring
- Offline mode support with automatic reconnection
- Persistent channel configuration
- Automatic updates

## Prerequisites

- Ubuntu Operating System
- Node.js (v14 or higher)
- npm (Node Package Manager)
- Administrative privileges for system commands

## Installation

1. Clone the repository:
```bash
git clone https://github.com/navgurukul/ubuntu-management-app.git
cd ubuntu-management-app
```

2. Install dependencies:
```bash
npm install
```

3. Start the application:
```bash
npm start
```

## Project Structure

```
ubuntu-management-app/
├── main.js                 # Main electron process
├── index.html             # User interface
├── windows/
│   └── mainWindow.js      # Window management
├── utils/
│   ├── autoUpdater.js     # Auto-update functionality
│   ├── channel.js         # Channel management
│   ├── commands.js        # Command execution
│   ├── config.js          # Configuration management
│   ├── database.js        # Database operations
│   ├── fileSystem.js      # File system operations
│   ├── network.js         # Network connectivity
│   └── system.js          # System utilities
├── websocket/
│   └── client.js          # WebSocket client
└── config/
    └── paths.js           # Application paths
```

## Configuration

The application stores its configuration in the following locations:
- Channel configuration: `~/.config/ubuntu-management-app/channel.json`
- Application configuration: `~/.config/ubuntu-management-app/config.json`
- Database: `~/.config/ubuntu-management-app/system_tracking.db`

## Features in Detail

### Remote Command Execution
- Supports standard Ubuntu terminal commands
- Executes commands with proper error handling
- Returns command execution status to the server

### Software Installation
- Automated package installation using apt
- Creates desktop shortcuts automatically
- Verifies executable paths
- Sets up proper permissions

### Wallpaper Management
- Supports remote wallpaper setting
- Handles URLs for wallpaper images
- Supports GNOME desktop environment

### System Tracking
- Tracks system usage
- Records active time
- Monitors location data
- Syncs data with remote server

### Network Handling
- Automatic offline detection
- Reconnection attempts every 5 seconds
- Persistent WebSocket connection
- Command queuing during offline periods

## WebSocket Communication

The application maintains a WebSocket connection to `wss://rms.thesama.in` and handles:
- Channel-based subscriptions
- Command reception and execution
- Status reporting
- Error handling

## Security Features

- Requires administrative privileges for system modifications
- Validates command inputs
- Secure WebSocket connection
- Error handling for malformed commands

## Error Handling

The application includes comprehensive error handling for:
- Network disconnections
- Invalid commands
- Installation failures
- File system errors
- Database operations

## Development

### Building from Source
```bash
# Clone the repository
git clone [repository-url]

# Install dependencies
npm install

# Start in development mode
npm start

# Build for production
npm run build
```

### Adding New Features
1. Create new utility modules in the appropriate directory
2. Update the WebSocket client for new command types
3. Add error handling
4. Test thoroughly

## Troubleshooting

Common issues and solutions:

1. Window not showing:
   - Check channel.json and config.json in the user data directory
   - Reset channel using the reset function

2. Commands not executing:
   - Verify sudo privileges
   - Check network connection
   - Inspect WebSocket connection status

3. Software installation failures:
   - Verify package name
   - Check system's apt sources
   - Ensure internet connectivity

## Contributing

1. Fork the repository
2. Create a feature branch
3. Commit changes
4. Push to the branch
5. Create a Pull Request

## License

[Specify License]

## Support

For support, please:
1. Check the issues section
2. Contact the system administrator
3. Review the documentation

## Future Enhancements

Planned features:
- Multi-channel support
- Enhanced security features
- Additional command types
- Extended system monitoring
- Improved offline capabilities
