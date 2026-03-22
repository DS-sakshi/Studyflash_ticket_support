import urllib.parse

CLIENT_ID = "ee8730cc-0879-4567-8598-a94b9f061245"  # from Azure Portal
TENANT_ID = "consumers"
REDIRECT_URI = "http://localhost:8001/api/outlook/callback"
SCOPES = "Mail.Read Mail.ReadWrite Mail.Send offline_access"

params = {
    "client_id": CLIENT_ID,
    "response_type": "code",
    "redirect_uri": REDIRECT_URI,
    "scope": SCOPES,
    "response_mode": "query"
}

url = f"https://login.microsoftonline.com/{TENANT_ID}/oauth2/v2.0/authorize?{urllib.parse.urlencode(params)}"
print(url)