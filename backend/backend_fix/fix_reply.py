with open("backend/server.py", "r") as f:
    content = f.read()

# Fix: escape single quotes in conversationId for OData filter
old = '''    async def send_reply(self, conversation_id: str, reply_body: str, to_email: str):
        """Reply within an existing Outlook conversation thread."""
        import httpx
        token = await self._get_token()
        # Find the latest message in this conversation
        url = (
            f"{self.GRAPH_URL}/me/messages"
            f"?$filter=conversationId eq '{conversation_id}'"
            f"&$orderby=receivedDateTime desc&$top=1"
        )
        async with httpx.AsyncClient() as http:
            resp = await http.get(url, headers=self._headers(token))
            resp.raise_for_status()
            messages = resp.json().get("value", [])
            if not messages:
                raise Exception(f"No messages found for conversation {conversation_id}")
            original_id = messages[0]["id"]
            reply_url = f"{self.GRAPH_URL}/me/messages/{original_id}/reply"
            await http.post(reply_url, headers=self._headers(token), json={
                "message": {"toRecipients": [{"emailAddress": {"address": to_email}}]},'''

new = '''    async def send_reply(self, conversation_id: str, reply_body: str, to_email: str):
        """Reply within an existing Outlook conversation thread."""
        import httpx
        token = await self._get_token()
        # Escape single quotes in conversationId for OData filter
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
            original_id = messages[0]["id"]
            reply_url = f"{self.GRAPH_URL}/me/messages/{original_id}/reply"
            await http.post(reply_url, headers=self._headers(token), json={
                "message": {"toRecipients": [{"emailAddress": {"address": to_email}}]},'''

if old in content:
    content = content.replace(old, new)
    print("✅ Fix applied: conversationId single quotes escaped")
else:
    print("❌ Could not find send_reply block — checking partial match...")
    if "conversationId eq '{conversation_id}'" in content:
        content = content.replace(
            "conversationId eq '{conversation_id}'",
            "conversationId eq '{safe_conv_id}'"
        )
        # Also add the escape line before the url definition
        content = content.replace(
            "        # Find the latest message in this conversation\n        url = (",
            "        # Escape single quotes in conversationId for OData filter\n        safe_conv_id = conversation_id.replace(\"'\", \"''\")\n        url = ("
        )
        print("✅ Fix applied via partial match")
    else:
        print("❌ Fix failed - paste your send_reply function here")

with open("backend/server.py", "w") as f:
    f.write(content)

print("✅ Done!")
