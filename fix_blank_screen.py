from pathlib import Path

path = Path('src/App.jsx')
if not path.exists():
    raise SystemExit('src/App.jsx not found. Run this from your project root folder.')
text = path.read_text(encoding='utf-8')

# Fix missing Clock import used on the Profile Pending screen.
header = text.split("from 'lucide-react';")[0]
if "Clock" not in header:
    text = text.replace("CheckCircle2, ClipboardList, Copy, Database, ExternalLink,", "CheckCircle2, ClipboardList, Clock, Copy, Database, ExternalLink,")

path.write_text(text, encoding='utf-8')
print('Fixed App.jsx: added missing Clock import. Now run npm run dev again.')
