from flask import Flask, render_template, request, jsonify, send_file
import os
from werkzeug.utils import secure_filename
import PyPDF2
from gtts import gTTS
import uuid
from transformers import BartForConditionalGeneration, BartTokenizer
import torch
import re

model_name = "sshleifer/distilbart-cnn-12-6"

use_cuda = torch.cuda.is_available()

tokenizer = BartTokenizer.from_pretrained(model_name)
model = BartForConditionalGeneration.from_pretrained(model_name)

if use_cuda:
    model = model.cuda()

app = Flask(__name__)
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['AUDIO_FOLDER'] = 'audio'
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024  # 16MB max file size

# Create directories if they don't exist
os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
os.makedirs(app.config['AUDIO_FOLDER'], exist_ok=True)

ALLOWED_EXTENSIONS = {'pdf'}

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def clean_summary_text(summary):
    if not summary:
        return summary

    summary = re.sub(r'^(Summarize the following text.*|The text discusses.*|This text.*|The following text.*|The document.*|This document.*|The passage.*|This passage.*)', '', summary, flags=re.IGNORECASE)

    summary = re.sub(r'Change and/or cancel your housing preference or lease.*', '', summary, flags=re.IGNORECASE)

    summary = re.sub(r'\b(?:in summary|to summarize|in conclusion|overall|basically|essentially|simply put|put simply|in brief|briefly)\b', '', summary, flags=re.IGNORECASE)

    summary = re.sub(r'[.!?]{2,}', '.', summary)
    summary = re.sub(r'[,]{2,}', ',', summary)
    summary = re.sub(r'[:]{2,}', ':', summary)
    summary = re.sub(r'[-]{2,}', '-', summary)
    summary = re.sub(r'\s+', ' ', summary)

    summary = re.sub(r'Summarize the following text.*', '', summary, flags=re.IGNORECASE | re.DOTALL)
    summary = re.sub(r'Requirements?:.*?Text to summarize:', '', summary, flags=re.IGNORECASE | re.DOTALL)
    summary = re.sub(r'Text to summarize:.*', '', summary, flags=re.IGNORECASE | re.DOTALL)
    summary = re.sub(r'Following text:.*', '', summary, flags=re.IGNORECASE | re.DOTALL)

    # Final cleanups
    summary = summary.strip()
    if summary and summary[0].islower():
        summary = summary[0].upper() + summary[1:]
    if summary and not summary[-1] in '.!?':
        summary += '.'

    return summary

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file part'}), 400

    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400

    if file and allowed_file(file.filename):
        # Clean up any existing PDF files from previous uploads
        for old_file in os.listdir(app.config['UPLOAD_FOLDER']):
            if old_file.endswith('.pdf'):
                old_filepath = os.path.join(app.config['UPLOAD_FOLDER'], old_file)
                try:
                    os.remove(old_filepath)
                except:
                    pass  # Ignore errors when cleaning up

        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)

        try:
            # Read PDF and get page count
            pdfReader = PyPDF2.PdfReader(filepath)
            total_pages = len(pdfReader.pages)

            return jsonify({
                'success': True,
                'total_pages': total_pages,
                'filename': filename,
                'temp_filename': filename
            })
        except Exception as e:
            # Clean up on error
            if os.path.exists(filepath):
                os.remove(filepath)
            return jsonify({'error': f'Error reading PDF: {str(e)}'}), 500

    return jsonify({'error': 'Invalid file type'}), 400


page_num = None
@app.route('/convert', methods=['POST'])
def convert_pdf():
    data = request.get_json()
    filename = data.get('filename')
    global page_num
    page_num = data.get('page_num')
    temp_filename = data.get('temp_filename')

    if not filename or not page_num or not temp_filename:
        return jsonify({'error': 'Missing required data'}), 400

    try:
        # Find the temporary PDF file
        temp_pdf_path = os.path.join(app.config['UPLOAD_FOLDER'], temp_filename)

        if not os.path.exists(temp_pdf_path):
            return jsonify({'error': 'PDF file not found. Please re-upload.'}), 400

        # Check if audio file already exists for this page
        existing_audio = None
        for audio_file in os.listdir(app.config['AUDIO_FOLDER']):
            if audio_file.startswith(f"page_{page_num}_"):
                existing_audio = audio_file
                break

        if existing_audio:
            # Audio already exists, return it without converting
            # Don't delete PDF file here - keep it for other page conversions
            return jsonify({
                'success': True,
                'audio_file': existing_audio,
                'message': f'Page {page_num} audio already exists',
                'already_converted': True
            })

        # Read the PDF and extract text from the specified page
        pdfReader = PyPDF2.PdfReader(temp_pdf_path)

        if page_num < 1 or page_num > len(pdfReader.pages):
            return jsonify({'error': 'Invalid page number'}), 400

        page = pdfReader.pages[page_num - 1]
        text = page.extract_text() or "No text found on this page."

        global last_text
        last_text = page.extract_text() or "No text found on this page."

        # Generate audio filename
        audio_filename = f"page_{page_num}_{uuid.uuid4()}.mp3"
        audio_path = os.path.join(app.config['AUDIO_FOLDER'], audio_filename)

        # Convert text to speech
        tts = gTTS(text=text, lang='en', slow=False)
        tts.save(audio_path)

        # Don't delete PDF file here - keep it for other page conversions
        # The PDF will be cleaned up when a new file is uploaded or when the session ends

        return jsonify({
            'success': True,
            'audio_file': audio_filename,
            'message': f'Successfully converted page {page_num} to audio',
            'already_converted': False
        })

    except Exception as e:
        # Don't delete PDF file on error - keep it for retry
        return jsonify({'error': f'Conversion error: {str(e)}'}), 500

@app.route('/audio/<filename>')
def get_audio(filename):
    audio_path = os.path.join(app.config['AUDIO_FOLDER'], filename)
    if os.path.exists(audio_path):
        return send_file(audio_path, mimetype='audio/mpeg')
    return jsonify({'error': 'Audio file not found'}), 404

@app.route('/cleanup', methods=['POST'])
def cleanup_files():
    """Clean up uploaded PDF files and audio files"""
    try:
        # Clean up PDF files
        for pdf_file in os.listdir(app.config['UPLOAD_FOLDER']):
            if pdf_file.endswith('.pdf'):
                pdf_filepath = os.path.join(app.config['UPLOAD_FOLDER'], pdf_file)
                try:
                    os.remove(pdf_filepath)
                except:
                    pass

        # Clean up audio files
        for audio_file in os.listdir(app.config['AUDIO_FOLDER']):
            if audio_file.endswith('.mp3'):
                audio_filepath = os.path.join(app.config['AUDIO_FOLDER'], audio_file)
                try:
                    os.remove(audio_filepath)
                except:
                    pass

        return jsonify({'success': True, 'message': 'Cleanup completed'})
    except Exception as e:
        return jsonify({'error': f'Cleanup failed: {str(e)}'}), 500

last_text = ""
last_summarized_text = ""
@app.route('/summarize', methods=['POST'])
def pdf_summarize():
    global last_text, last_summarized_text

    if not last_text:
        return jsonify({'error': 'No text available to summarize'}), 400

    """instruction = (
        "Summarize the following text in a concise, factual way. "
        "Avoid unnecessary details, adjectives, or filler. "
        "Focus only on the key points and main ideas:\n\n"
        "Don't mention tha fact that you are summarizing the text"
        "Focus on the raw data provided by the text that you are summarizing"
        "Don't contain any support links information that isn't related to the content of the text"
    )"""

    inputs = tokenizer([last_text], max_length=1024, return_tensors='pt', truncation=True)

    summary_ids = model.generate(inputs['input_ids'], num_beams=8, length_penalty=1.5, max_length=600, min_length=300, no_repeat_ngram_size=3)

    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)

    # Clean the summary to remove artifacts and improve readability

    """
    tool.correct(txt)
    cleaned_summary = clean_summary_text(summary)
    """

    #txt = clean_summary_text(summary)
    #cleaned_summary = tool.correct(txt)

    cleaned_summary = clean_summary_text(summary)
    last_summarized_text = cleaned_summary

    return jsonify({'success': True, 'summary': cleaned_summary})

@app.route('/summary-audio', methods=['POST'])
def summary_audio():
    global last_summarized_text, page_num
    if not last_summarized_text:
        return jsonify({'error': 'No summary available to convert'}), 400

    summary_audio_filename = f"page_{page_num}_{uuid.uuid4()}_summary.mp3"
    audio_path = os.path.join(app.config['AUDIO_FOLDER'], summary_audio_filename)

    # Convert summary text to speech
    tts = gTTS(text=last_summarized_text, lang='en', slow=False)
    tts.save(audio_path)

    return jsonify({
        'success': True,
        'audio_file': summary_audio_filename,
        'message': f'Successfully converted summary of page {page_num} to audio',
        'already_converted': False
    })
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 5000))
    app.run(debug=True, host='0.0.0.0', port=port)
