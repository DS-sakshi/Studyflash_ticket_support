with open("backend/server.py", "r") as f:
    content = f.read()

old = '''        # Escape single quotes in conversationId for OData filter
        safe_conv_id = conversation_id.replace("'", "''")
        url = (
            f"{self.GRAPH_URL}/me/messages"
            f"?$filter=conversationId eq '{safe_conv_id}'"
            f"&$orderby=receivedDateTime desc&$top=1"
        )
        async with httpx.AsyncClient() as http:
            resp = await http.get(url, headers=self._headers(token))
            if resp.status_code != 200:
                logger.error(f"Failed to find conversation: {resp.text}")
                raise Exception(f"Could not find conversation {conversation_id}: {resp.status_code}")
            messages = resp.json().get("value", [])
            if not messages:
                raise Exception(f"No messages found for conversation {conversation_id}")
            original_id = messages[0]["id"]'''

new = '''        # Microsoft Graph doesn't allow $filter + $orderby on conversationId
        # So fetch by conversationId only, then sort in Python
        safe_conv_id = conversation_id.replace("'", "''")
        url = (
            f"{self.GRAPH_URL}/me/messages"
            f"?$filter=conversationId eq '{safe_conv_id}'"
            f"&$top=10&$select=id,receivedDateTime,conversationId"
        )
        async with httpx.AsyncClient() as http:
            resp = await http.get(url, headers=self._headers(token))
            if resp.status_code != 200:
                logger.error(f"Failed to find conversation: {resp.text}")
                raise Exception(f"Could not find conversation {conversation_id}: {resp.status_code}")
            messages = resp.json().get("value", [])
            if not messages:
                raise Exception(f"No messages found for conversation {conversation_id}")
            # Sort by receivedDateTime in Python instead of OData
            messages.sort(key=lambda x: x.get("receivedDateTime", ""), reverse=True)
            original_id = messages[0]["id"]'''

if old in content:
    content = content.replace(old, new)
    print("✅ Fix applied: removed $orderby from conversationId filter")
else:
    print("❌ Exact match failed — trying partial fix...")
    old2 = 'f"?$filter=conversationId eq \'{safe_conv_id}\'"\n            f"&$orderby=receivedDateTime desc&$top=1"'
    new2 = 'f"?$filter=conversationId eq \'{safe_conv_id}\'"\n            f"&$top=10&$select=id,receivedDateTime,conversationId"'
    if old2 in content:
        content = content.replace(old2, new2)
        print("✅ Fix applied via partial match")
    else:
        print("❌ Fix failed — paste your send_reply function")

with open("backend/server.py", "w") as f:
    f.write(content)
print("✅ Done!")
