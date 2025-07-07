#!/usr/bin/env python3

from docx import Document
import sys

def extract_text_from_docx(file_path):
    """Extract text content from a Word document."""
    try:
        doc = Document(file_path)
        full_text = []
        
        for paragraph in doc.paragraphs:
            if paragraph.text.strip():
                full_text.append(paragraph.text)
        
        return '\n'.join(full_text)
    except Exception as e:
        return f"Error reading document: {str(e)}"

if __name__ == "__main__":
    docx_path = "/home/ubuntu/upload/BuildamobileappandwebdashboardsystemforV3ServicesLtdthatallowsustodeployfieldagentsquicklyforurgent.docx"
    content = extract_text_from_docx(docx_path)
    
    # Save to text file
    with open("/home/ubuntu/requirements.txt", "w", encoding="utf-8") as f:
        f.write(content)
    
    print("Document content extracted successfully!")
    print(f"Content length: {len(content)} characters")

