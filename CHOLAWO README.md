This is running as a service.

It's accessible from the internet via cloudflare tunnels.
https://dash.cloudflare.com/b347182bdc667ddb017bcda35de36e62/tunnels/26c65c28-c6f9-49ef-95b7-f03b2085ee43/routes

To edit it:
sudo systemctl edit --full openhab-google-assistant.service

After saving, reload and restart:
sudo systemctl daemon-reload
sudo systemctl restart openhab-google-assistant.service
sudo systemctl status openhab-google-assistant.service

To see logs:
journalctl -u openhab-google-assistant.service -f