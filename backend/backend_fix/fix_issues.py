import re

with open("backend/server.py", "r") as f:
    content = f.read()

# ── FIX 1: Add HTML stripping function after imports ──
html_strip_fn = '''
def strip_html(text: str) -> str:
    """Strip HTML tags and decode entities from email body."""
    if not text:
        return ""
    # Remove HTML tags
    clean = re.sub(r'<[^>]+>', ' ', text)
    # Replace common HTML entities
    clean = clean.replace('&lt;', '<').replace('&gt;', '>').replace('&amp;', '&').replace('&nbsp;', ' ').replace('<br>', '\\n')
    # Collapse whitespace
    clean = re.sub(r'\\s+', ' ', clean).strip()
    return clean

'''

if "def strip_html" not in content:
    # Insert after imports, before first @app or class
    insert_at = content.find('\ndef ')
    content = content[:insert_at] + '\n' + html_strip_fn + content[insert_at:]
    print("✅ Fix 1: strip_html function added")
else:
    print("⏭️  Fix 1: strip_html already exists")

# ── FIX 2: Strip HTML when storing body in process_incoming_email ──
old2 = '"body": data.body,'
new2 = '"body": strip_html(data.body),'
count2 = content.count(old2)
content = content.replace(old2, new2)
print(f"✅ Fix 2: HTML stripping applied to {count2} body storage location(s)")

# ── FIX 3: Fix missed /users/{mailbox} URL on line 897 ──
old3 = 'f"{OutlookClient.GRAPH_URL}/users/{outlook_client.mailbox}/messages/{message_id}"'
new3 = 'f"{OutlookClient.GRAPH_URL}/me/messages/{message_id}"'
if old3 in content:
    content = content.replace(old3, new3)
    print("✅ Fix 3: Remaining /users/{mailbox} URL fixed to /me")
else:
    print("⏭️  Fix 3: URL already correct")

# ── FIX 4: Also fix mailbox reference in subscription ──
old4 = 'f"users/{self.mailbox}/messages"'
new4 = '"me/messages"'
if old4 in content:
    content = content.replace(old4, new4)
    print("✅ Fix 4: Subscription mailbox URL fixed")
else:
    print("⏭️  Fix 4: Subscription URL already correct")

with open("backend/server.py", "w") as f:
    f.write(content)

print("\n✅ All fixes applied!")
