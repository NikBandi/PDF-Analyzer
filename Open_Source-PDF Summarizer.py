#import fitz
from transformers import BartForConditionalGeneration, BartTokenizer
import tkinter as tk
from tkinter import filedialog

model_name = "facebook/bart-large-cnn"
tokenizer = BartTokenizer.from_pretrained(model_name)
model = BartForConditionalGeneration.from_pretrained(model_name)


# Function to extract text from PDF
def extract_text_from_pdf(pdf_path):
    text = ""
    with fitz.open(pdf_path) as pdf_file:
        for page_num in range(len(pdf_file)):
            page = pdf_file.load_page(page_num)
            text += page.get_text()
    return text


# Function to summarize PDF and display on tkinter window
def summarize_and_display(pdf_path, summary_length):
    summary_text.delete(1.0, tk.END)
    summary_text.insert(tk.END, "This may take some time. Please be patient...\n")

    document = extract_text_from_pdf(pdf_path)
    valid_lengths = ["long", "medium", "short"]
    while summary_length.lower() not in valid_lengths:
        print("Invalid input. Please enter 'long', 'medium', or 'short'.")
        summary_length = input("Enter length of summary (long/medium/short):")

    if summary_length.lower() == "long":
        min_length = 800
    elif summary_length.lower() == "medium":
        min_length = 500
    elif summary_length.lower() == 'short':
        min_length = 100

    # Tokenize and encode the input document
    inputs = tokenizer([document], max_length=1024, return_tensors='pt', truncation=True)
    # Generate summary
    summary_ids = model.generate(inputs['input_ids'], num_beams=4, max_length=1000, min_length=min_length,
                                 early_stopping=False)
    # Decode and print the summary
    summary = tokenizer.decode(summary_ids[0], skip_special_tokens=True)
    summary_text.delete(1.0, tk.END)
    summary_text.insert(tk.END, summary)


# Function to handle file selection using tkinter
def select_file():
    file_path = filedialog.askopenfilename(filetypes=[("PDF files")])
    if file_path:
        pdf_path_entry.delete(0, tk.END)
        pdf_path_entry.insert(0, file_path)


# Create GUI
root = tk.Tk()
root.title("PDF Summarizer")

file_label = tk.Label(root, text="PDF File:")
file_label.grid(row=0, column=0)

pdf_path_entry = tk.Entry(root, width=50)
pdf_path_entry.grid(row=0, column=1)

browse_button = tk.Button(root, text="Browse", command=select_file)
browse_button.grid(row=0, column=2)

summary_length_label = tk.Label(root, text="Summary Length:")
summary_length_label.grid(row=1, column=0)

summary_length_entry = tk.Entry(root, width=10)
summary_length_entry.grid(row=1, column=1)

summarize_button = tk.Button(root, text="Summarize",
                             command=lambda: summarize_and_display(pdf_path_entry.get(), summary_length_entry.get()))
summarize_button.grid(row=1, column=2)

summary_text_label = tk.Label(root, text="Summary:")
summary_text_label.grid(row=2, column=0, columnspan=3)

summary_text = tk.Text(root, wrap=tk.WORD, width=60, height=10)
summary_text.grid(row=3, column=0, columnspan=3)

root.update()
root.mainloop()