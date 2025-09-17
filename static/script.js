document.addEventListener('DOMContentLoaded', function() {
    const uploadArea = document.getElementById('uploadArea');
    const pdfFileInput = document.getElementById('pdfFile');
    const conversionSection = document.getElementById('conversionSection');
    const pageSelect = document.getElementById('pageSelect');
    const convertBtn = document.getElementById('convertBtn');
    const summaryBtn = document.getElementById('summaryBtn');
    const audioPlayer = document.getElementById('audioPlayer');
    const audioElement = document.getElementById('audioElement');
    const downloadBtn = document.getElementById('downloadBtn');
    const newFileBtn = document.getElementById('newFileBtn');
    const currentFileName = document.getElementById('currentFileName');
    const fileStatus = document.getElementById('fileStatus');
    const status = document.getElementById('status');
    const summarySection = document.getElementById('summarySection');
    const summaryContent = document.getElementById('summaryContent');
    const summaryLoading = document.getElementById('summaryLoading');
    const summaryAudioSection = document.getElementById('summaryAudioSection');
    const summaryAudioBtn = document.getElementById('summaryAudioBtn');
    const summaryAudioPlayer = document.getElementById('summaryAudioPlayer');
    const summaryAudioElement = document.getElementById('summaryAudioElement');
    const downloadSummaryAudioBtn = document.getElementById('downloadSummaryAudioBtn');

    let currentFile = null;
    let currentAudioFile = null;
    let currentTempFilename = null;
    let convertedPages = new Set();
    let isFilePickerOpen = false;
    let currentSummaryAudioFile = null;

    // Drag & Drop events
    uploadArea.addEventListener('dragover', e => {
        e.preventDefault();
        uploadArea.classList.add('dragover');
    });
    uploadArea.addEventListener('dragleave', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
    });
    uploadArea.addEventListener('drop', e => {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        if (e.dataTransfer.files.length > 0) {
            handleFile(e.dataTransfer.files[0]);
        }
    });

    // File selection
    pdfFileInput.addEventListener('change', function(e) {
        isFilePickerOpen = false;
        if (e.target.files.length > 0) {
            handleFile(e.target.files[0]);
        }
    });
    pdfFileInput.addEventListener('focus', () => { isFilePickerOpen = true; });
    pdfFileInput.addEventListener('blur', () => {
        setTimeout(() => { isFilePickerOpen = false; }, 100);
    });
    uploadArea.addEventListener('click', function() {
        if (!isFilePickerOpen) {
            isFilePickerOpen = true;
            pdfFileInput.click();
        }
    });

    // Page selection
    pageSelect.addEventListener('change', function() {
        convertBtn.disabled = !this.value;
        summaryBtn.disabled = !this.value;
        summaryAudioBtn.disabled = !this.value;
    });
    convertBtn.addEventListener('click', function() {
        if (pageSelect.value && currentFile) {
            convertPage(parseInt(pageSelect.value));
        }
    });
    summaryBtn.addEventListener('click', function() {
        if (pageSelect.value && currentFile) {
            generateSummary(parseInt(pageSelect.value));
        }
    });
    summaryAudioBtn.addEventListener('click', function() {
        if (currentFile) {
            generateSummaryAudio();
        }
    });
    downloadBtn.addEventListener('click', downloadAudio);
    downloadSummaryAudioBtn.addEventListener('click', downloadSummaryAudio);
    newFileBtn.addEventListener('click', function() {
        resetForm();
        conversionSection.style.display = 'none';
        summarySection.style.display = 'none';
        summaryAudioSection.style.display = 'none';
        summaryAudioPlayer.style.display = 'none';
        uploadArea.style.display = 'block';
        pdfFileInput.value = '';
    });

    function handleFile(file) {
        if (!file.type.includes('pdf')) {
            showStatus('Please select a valid PDF file.', 'error');
            fileStatus.textContent = 'Invalid file type';
            return;
        }
        if (file.size > 16 * 1024 * 1024) {
            showStatus('File too large. Max 16MB.', 'error');
            fileStatus.textContent = 'File too large';
            return;
        }
        fileStatus.textContent = `Selected: ${file.name}`;
        
        // Clean up any ongoing audio conversion checks before handling new file
        if (window.currentCheckInterval) {
            clearInterval(window.currentCheckInterval);
            window.currentCheckInterval = null;
        }
        
        resetForm();
        currentFile = file;
        showStatus('Uploading PDF...', 'info');
        cleanupOldFiles().then(() => uploadFile(file));
    }

    function uploadFile(file) {
        const formData = new FormData();
        formData.append('file', file);
        fetch('/upload', { method: 'POST', body: formData })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                showStatus('PDF uploaded successfully!', 'success');
                currentTempFilename = data.temp_filename;
                populatePageSelector(data.total_pages);
                conversionSection.style.display = 'block';
                audioPlayer.style.display = 'none';
                summarySection.style.display = 'none';
                summaryAudioSection.style.display = 'none';
                summaryAudioPlayer.style.display = 'none';
                currentFileName.textContent = currentFile.name;
            } else {
                showStatus(data.error || 'Upload failed.', 'error');
            }
        })
        .catch(() => showStatus('Upload failed. Please try again.', 'error'));
    }

    function populatePageSelector(totalPages) {
        pageSelect.innerHTML = '<option value="">Select a page...</option>';
        for (let i = 1; i <= totalPages; i++) {
            const opt = document.createElement('option');
            opt.value = i;
            opt.textContent = `Page ${i}`;
            pageSelect.appendChild(opt);
        }
    }

    function convertPage(pageNum) {
        fetch('/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFile.name,
                page_num: pageNum,
                temp_filename: currentTempFilename
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                if (data.already_converted) {
                    showStatus('Audio already exists for this page!', 'success');
                    currentAudioFile = data.audio_file;
                    audioElement.src = `/audio/${data.audio_file}?t=${Date.now()}`;
                    audioElement.load();
                    audioPlayer.style.display = 'block';
                    downloadBtn.disabled = false;
                } else {
                    showStatus('Processing page...', 'info');
                    convertBtn.disabled = true;
                    convertBtn.innerHTML = '<span class="loading"></span>Processing...';
                    waitForAudioFile(data.audio_file, pageNum);
                }
            } else {
                showStatus(data.error || 'Conversion failed.', 'error');
            }
        })
        .catch(() => showStatus('Conversion failed. Please try again.', 'error'));
    }

    function waitForAudioFile(audioFilename, pageNum) {
        // Wait 2 seconds before starting to check for the audio file
        setTimeout(() => {
            const checkInterval = setInterval(() => {
                fetch(`/audio/${audioFilename}`)
                    .then(response => {
                        if (response.ok) {
                            clearInterval(checkInterval);
                            convertBtn.disabled = false;
                            convertBtn.innerHTML = '<i class="fas fa-play"></i> Convert to Audio';
                            showStatus('Audio conversion completed!', 'success');
                            currentAudioFile = audioFilename;
                            audioElement.src = `/audio/${audioFilename}?t=${Date.now()}`;
                            audioElement.load();
                            audioPlayer.style.display = 'block';
                            downloadBtn.disabled = false;
                            convertedPages.add(pageNum);
                        }
                    })
                    .catch(() => {});
            }, 500);
        }, 2000);

        setTimeout(() => {
            clearInterval(checkInterval);
            if (!currentAudioFile) {
                convertBtn.disabled = false;
                convertBtn.innerHTML = '<i class="fas fa-play"></i> Convert to Audio';
                showStatus('Audio conversion timed out. Please try again.', 'error');
            }
        }, 30000);
    }

    function generateSummary(pageNum) {
        // Show summary section and loading state
        summarySection.style.display = 'block';
        summaryLoading.style.display = 'block';
        summaryContent.style.display = 'none';
        summaryBtn.disabled = true;
        summaryBtn.innerHTML = '<span class="loading"></span>Generating...';

        // First, we need to get the text from the page to generate a summary
        // We'll use the convert endpoint to extract the text, then generate summary
        fetch('/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                filename: currentFile.name,
                page_num: pageNum,
                temp_filename: currentTempFilename
            })
        })
        .then(r => r.json())
        .then(data => {
            if (data.success) {
                // Now generate the summary using the extracted text
                return fetch('/summarize', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
            } else {
                throw new Error(data.error || 'Failed to extract text from page');
            }
        })
        .then(r => r.json())
        .then(data => {
            summaryLoading.style.display = 'none';
            summaryBtn.disabled = false;
            summaryBtn.innerHTML = '<i class="fas fa-file-text"></i> Generate Summary';
            
            if (data.success) {
                summaryContent.innerHTML = `<p><strong>Summary of Page ${pageNum}:</strong></p><p>${data.summary}</p>`;
                summaryContent.style.display = 'block';
                summaryAudioSection.style.display = 'block';
                showStatus('Summary generated successfully!', 'success');
            } else {
                summaryContent.innerHTML = `<p style="color: #dc3545;">Error: ${data.error || 'Failed to generate summary'}</p>`;
                summaryContent.style.display = 'block';
                showStatus('Summary generation failed.', 'error');
            }
        })
        .catch((error) => {
            summaryLoading.style.display = 'none';
            summaryBtn.disabled = false;
            summaryBtn.innerHTML = '<i class="fas fa-file-text"></i> Generate Summary';
            summaryContent.innerHTML = `<p style="color: #dc3545;">Error: ${error.message || 'Failed to generate summary. Please try again.'}</p>`;
            summaryContent.style.display = 'block';
            showStatus('Summary generation failed.', 'error');
        });
    }

    function cleanupOldFiles() {
        return fetch('/cleanup', { method: 'POST' })
        .then(r => r.json())
        .catch(() => {});
    }

    function downloadAudio() {
        if (currentAudioFile) {
            const link = document.createElement('a');
            link.href = `/audio/${currentAudioFile}?t=${Date.now()}`;
            link.download = `page_${pageSelect.value}_audio.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function generateSummaryAudio() {
        // Show loading state
        summaryAudioBtn.disabled = true;
        summaryAudioBtn.innerHTML = '<span class="loading"></span>Generating...';
        summaryAudioPlayer.style.display = 'none';

        fetch('/summary-audio', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        })
        .then(r => r.json())
        .then(data => {
            summaryAudioBtn.disabled = false;
            summaryAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Generate Summary Audio';
            
            if (data.success) {
                currentSummaryAudioFile = data.audio_file;
                summaryAudioElement.src = `/audio/${data.audio_file}?t=${Date.now()}`;
                summaryAudioElement.load();
                summaryAudioPlayer.style.display = 'block';
                summaryDownloadSection.style.display = 'block';
                showStatus('Summary audio generated successfully!', 'success');
            } else {
                showStatus(data.error || 'Failed to generate summary audio', 'error');
            }
        })
        .catch((error) => {
            summaryAudioBtn.disabled = false;
            summaryAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Generate Summary Audio';
            showStatus('Summary audio generation failed. Please try again.', 'error');
        });
    }

    function downloadSummaryAudio() {
        if (currentSummaryAudioFile) {
            const link = document.createElement('a');
            link.href = `/audio/${currentSummaryAudioFile}?t=${Date.now()}`;
            link.download = `page_${pageSelect.value}_summary_audio.mp3`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    }

    function showStatus(message, type) {
        status.textContent = message;
        status.className = `status ${type}`;
        status.style.display = 'block';
        if (type === 'success') {
            setTimeout(() => { status.style.display = 'none'; }, 5000);
        }
    }

    function resetForm() {
        conversionSection.style.display = 'none';
        audioPlayer.style.display = 'none';
        summarySection.style.display = 'none';
        summaryAudioSection.style.display = 'none';
        summaryAudioPlayer.style.display = 'none';
        pageSelect.innerHTML = '<option value="">Select a page...</option>';
        convertBtn.disabled = true;
        convertBtn.innerHTML = '<i class="fas fa-play"></i> Convert to Audio';
        summaryBtn.disabled = true;
        summaryBtn.innerHTML = '<i class="fas fa-file-text"></i> Generate Summary';
        summaryAudioBtn.disabled = true;
        summaryAudioBtn.innerHTML = '<i class="fas fa-volume-up"></i> Generate Summary Audio';
        downloadBtn.disabled = true;
        currentAudioFile = null;
        currentSummaryAudioFile = null;
        currentTempFilename = null;
        currentFile = null;
        currentFileName.textContent = '';
        convertedPages.clear();
        status.style.display = 'none';
    }
});