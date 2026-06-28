import re

with open("index.html", "r", encoding="utf-8", errors="replace") as f:
    content = f.read()

match = re.search(r'class="nav-brand-icon">(.*?)</span>', content)
if match:
    text = match.group(1)
    print("Length:", len(text))
    print("Codepoints:", [ord(c) for c in text])
    print("Text representation:", repr(text))
else:
    print("No match")
