with open("backend/server.py", "r") as f:
    content = f.read()

# Add background sync task that runs every 60 seconds
auto_sync_code = '''
@app.on_event("startup")
async def start_background_sync():
    """Auto sync emails from Outlook every 60 seconds."""
    import asyncio
    async def sync_loop():
        while True:
            try:
                if OUTLOOK_ENABLED and outlook_client._token:
                    emails = await outlook_client.fetch_new_emails()
                    for email in emails:
                        await process_incoming_email(email["id"])
                    if emails:
                        logger.info(f"Auto sync: processed {len(emails)} new email(s)")
            except Exception as e:
                logger.error(f"Auto sync error: {e}")
            await asyncio.sleep(60)  # runs every 60 seconds
    asyncio.create_task(sync_loop())

'''

# Insert before the last app run or after app definition
if "start_background_sync" not in content:
    # Find a good insertion point - after app and router setup
    insert_marker = 'app.include_router(api_router'
    idx = content.rfind(insert_marker)
    # Find end of that line
    end_of_line = content.find('\n', idx) + 1
    content = content[:end_of_line] + auto_sync_code + content[end_of_line:]
    print("✅ Auto sync background task added")
else:
    print("⏭️  Auto sync already exists")

with open("backend/server.py", "w") as f:
    f.write(content)

print("✅ Done!")
