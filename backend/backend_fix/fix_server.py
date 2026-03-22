# Read the file
with open("backend/server.py", "r") as f:
    content = f.read()

# ── EDIT 1: Insert callback endpoint before /outlook/sync ──
old = '@api_router.post("/outlook/sync")'
new = '''@api_router.get("/outlook/callback")
async def outlook_callback(code: str):
    import httpx, time
    async with httpx.AsyncClient() as http:
        resp = await http.post(
            "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
            data={
                "client_id": outlook_client.client_id,
                "client_secret": outlook_client.client_secret,
                "code": code,
                "redirect_uri": "http://localhost:8001/api/outlook/callback",
                "grant_type": "authorization_code",
            }
        )
        data = resp.json()
    if "access_token" in data:
        outlook_client._token = data["access_token"]
        outlook_client._token_expires = time.time() + data.get("expires_in", 3600)
        outlook_client._refresh_token = data.get("refresh_token", "")
        return {"message": "Outlook connected successfully!"}
    return {"error": data.get("error_description", "Unknown error")}

@api_router.post("/outlook/sync")'''

if old in content:
    content = content.replace(old, new)
    print("✅ Edit 1 done: callback endpoint added")
else:
    print("❌ Edit 1 failed: could not find /outlook/sync")

# ── EDIT 2: Replace _get_token method ──
old2 = '''    async def _get_token(self) -> str:
        """Acquire an app-only token via OAuth2 client credentials."""
        import httpx
        import time
        if self._token and time.time() < self._token_expires - 60:
            return self._token
        url = f"https://login.microsoftonline.com/{self.tenant_id}/oauth2/v2.0/token"
        async with httpx.AsyncClient() as http:
            resp = await http.post(url, data={
                "client_id": self.client_id,
                "client_secret": self.client_secret,
                "scope": "https://graph.microsoft.com/.default",
                "grant_type": "client_credentials",
            })
            resp.raise_for_status()
            data = resp.json()
        self._token = data["access_token"]
        self._token_expires = time.time() + data.get("expires_in", 3600)
        return self._token'''

new2 = '''    async def _get_token(self) -> str:
        """Acquire token via delegated OAuth2 flow."""
        import httpx, time
        if self._token and time.time() < self._token_expires - 60:
            return self._token
        if hasattr(self, "_refresh_token") and self._refresh_token:
            async with httpx.AsyncClient() as http:
                resp = await http.post(
                    "https://login.microsoftonline.com/consumers/oauth2/v2.0/token",
                    data={
                        "client_id": self.client_id,
                        "client_secret": self.client_secret,
                        "refresh_token": self._refresh_token,
                        "grant_type": "refresh_token",
                        "scope": "Mail.Read Mail.ReadWrite Mail.Send offline_access",
                    }
                )
                data = resp.json()
            if "access_token" in data:
                self._token = data["access_token"]
                self._token_expires = time.time() + data.get("expires_in", 3600)
                self._refresh_token = data.get("refresh_token", self._refresh_token)
                return self._token
        raise Exception("Outlook not authenticated. Please visit /api/outlook/login first.")'''

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Edit 2 done: _get_token updated")
else:
    print("❌ Edit 2 failed: could not find _get_token — check spacing")

# ── EDIT 3: Replace /users/{mailbox} with /me ──
old3 = f"/users/{{self.mailbox}}"
new3 = "/me"
count = content.count(old3)
content = content.replace(old3, new3)
print(f"✅ Edit 3 done: replaced {count} instance(s) of /users/mailbox with /me")

# Write the file back
with open("backend/server.py", "w") as f:
    f.write(content)

print("\n✅ All edits complete! Run: docker compose down && docker compose up --build")

