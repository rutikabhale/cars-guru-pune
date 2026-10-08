# Cars Guru Pune — V12 Docker Ready

Premium Cars Guru Pune dealership demo with responsive customer website and admin panel.

## Features
- Responsive desktop/tablet/mobile UI
- Inventory add/edit/remove
- Available / Reserved / Sold status
- Featured cars and multiple images
- Compare cars
- Analytics dashboard
- Enquiry/lead management
- Admin login + change password
- Direct WhatsApp enquiries to +91 99231 13211
- Docker + Render ready

## Run with Node.js
```bash
npm install
npm start
```
Open http://localhost:4000
Admin: http://localhost:4000/admin

Demo credentials:
- Email: admin@carsguru.local
- Password: CarsGuru@123

## Run with Docker
```bash
docker build -t cars-guru-pune .
docker run --rm -p 4000:4000 cars-guru-pune
```
Open http://localhost:4000

## Render
This repo includes `render.yaml` and a production Dockerfile. Connect the GitHub repository to Render as a Docker Web Service.

## Demo storage note
The demo uses `server/db.json` and `server/uploads`. Container filesystems are not reliable permanent storage on hosted platforms. For production, move inventory to PostgreSQL and images to persistent/cloud object storage.
