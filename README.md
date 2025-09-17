# PDF Analyzer Website

A modern web application that converts PDF pages into high-quality audio using text-to-speech technology.

## Features

- 🎯 **PDF Upload**: Drag & drop or click to upload PDF files
- 📄 **Page Selection**: Choose specific pages to convert
- 🔊 **Audio Conversion**: Convert PDF text to speech using Google TTS
- 🎵 **Audio Player**: Built-in audio player with controls
- 💾 **Download**: Download converted audio files
- 📱 **Responsive Design**: Works on desktop and mobile devices
- 🎨 **Modern UI**: Beautiful gradient design with smooth animations

## Technology Stack

- **Backend**: Flask (Python)
- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **PDF Processing**: PyPDF2
- **Text-to-Speech**: Google TTS (gTTS)
- **Styling**: Custom CSS with Font Awesome icons

## Installation

1. **Clone or download** this project to your local machine

2. **Create a Virtual Environment (Reccomended)**:
   ```bash
   python -m venv venv
      ```
      windows (Powershell):
      ```bash
      \venv\Scripts\activate
      ```
      mac:
      ```bash
      source my-venv/bin/activate
      ```

4. **Install Python dependencies**:
   ```bash
   pip install -r requirements.txt
   ```

5. **Run the application**:
   ```bash
   python app.py
   ```

6. **Open your browser** and navigate to:
   ```
   http://localhost:5000
   ```

## Usage

1. **Upload PDF**: Drag and drop a PDF file or click the upload area to browse
2. **Select Page**: Choose which page you want to convert to audio
3. **Convert**: Click the "Convert to Audio" button
4. **Listen**: Use the built-in audio player to listen to the converted audio
5. **Download**: Download the audio file for offline use

## File Structure

```
PDF Analyzer Website/
├── app.py                 # Flask backend application
├── main.py               # Original Tkinter application
├── requirements.txt      # Python dependencies
├── README.md            # This file
├── templates/           # HTML templates
│   └── index.html      # Main page template
├── static/             # Static files
│   ├── style.css       # CSS styles
│   └── script.js       # JavaScript functionality
├── uploads/            # Temporary PDF uploads (auto-created)
└── audio/              # Generated audio files (auto-created)
```

## Requirements

- Python 3.7 or higher
- Internet connection (for Google TTS)
- Modern web browser with JavaScript enabled

## Limitations

- Maximum file size: 16MB
- Supported format: PDF only
- Audio quality depends on internet connection for TTS
- Temporary files are cleaned up automatically

## Troubleshooting

- **Upload fails**: Check file size and ensure it's a valid PDF
- **Conversion fails**: Ensure stable internet connection for TTS service
- **Audio not playing**: Check browser audio settings and file permissions

## Development

To modify the application:

1. **Backend changes**: Edit `app.py`
2. **Frontend styling**: Modify `static/style.css`
3. **Frontend logic**: Update `static/script.js`
4. **HTML structure**: Edit `templates/index.html`

## License

This project is open source and available under the MIT License.

## Contributing

Feel free to submit issues, feature requests, or pull requests to improve this application.
