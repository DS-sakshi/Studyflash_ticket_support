with open("backend/server.py", "r") as f:
    content = f.read()

# ── FIX 1: Save token to MongoDB after successful auth ──
old1 = '''    if "access_token" in data:
        outlook_client._token = data["access_token"]
        outlook_client._token_expires = time.time() + data.get("expires_in", 3600)
        outlook_client._refresh_token = data.get("refresh_token", "")
        return {"message": "Outlook connected successfully!"}
    return {"error": data.get("error_description", "Unknown error")}'''

new1 = '''    if "access_token" in data:
        import time
        outlook_client._token = data["access_token"]
        outlook_client._token_expires = time.time() + data.get("expires_in", 3600)
        outlook_client._refresh_token = data.get("refresh_token", "")
        # Persist refresh token to MongoDB so it survives restarts
        await db.settings.update_one(
            {"key": "outlook_refresh_token"},
            {"$set": {"key": "outlook_refresh_token", "value": outlook_client._refresh_token}},
            upsert=True
        )
        return {"message": "Outlook connected successfully!"}
    return {"error": data.get("error_description", "Unknown error")}'''

if old1 in content:
    content = content.replace(old1, new1)
    print("✅ Fix 1: Token now saved to MongoDB after auth")
else:
    print("❌ Fix 1 failed: could not find callback token save block")

# ── FIX 2: Load token from MongoDB on startup ──
old2 = '''@app.on_event("startup")
async def start_background_sync():
    """Auto sync emails from Outlook every 60 seconds."""
    import asyncio
    async def sync_loop():'''

new2 = '''@app.on_event("startup")
async def start_background_sync():
    """Load persisted token and auto sync emails from Outlook every 60 seconds."""
    import asyncio, time
    # Load refresh token from MongoDB if it exists
    try:
        stored = await db.settings.find_one({"key": "outlook_refresh_token"})
        if stored and stored.get("value"):
            outlook_client._refresh_token = stored["value"]
            logger.info("✅ Outlook refresh token loaded from DB")
    except Exception as e:
        logger.error(f"Could not load Outlook token from DB: {e}")

    async def sync_loop():'''

if old2 in content:
    content = content.replace(old2, new2)
    print("✅ Fix 2: Token now loaded from MongoDB on startup")
else:
    print("❌ Fix 2 failed: could not find start_background_sync")

with open("backend/server.py", "w") as f:
    f.write(content)

print("\n✅ Done! Rebuild Docker after this.")
