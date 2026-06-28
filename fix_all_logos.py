import re

files = ["index.html", "about.html", "cnn/index.html", "ols/index.html"]

for filepath in files:
    with open(filepath, "r", encoding="utf-8", errors="replace") as f:
        content = f.read()
    
    # Simple regex to replace the entire span tag with the new universally supported swimming emoji logo
    new_content = re.sub(
        r'<span class="nav-brand-icon">.*?</span>',
        '<span class="nav-brand-icon">🏊</span>',
        content
    )
    
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(new_content)
    print(f"Successfully fixed logo in {filepath}")
