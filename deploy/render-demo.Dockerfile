FROM python:3.13.3-slim-bookworm
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PYTHONPATH=/app/backend:/app
WORKDIR /app
COPY backend/requirements.txt /app/backend/requirements.txt
RUN pip install --no-cache-dir -r backend/requirements.txt \
    && useradd --uid 10001 --create-home app
COPY backend/app /app/backend/app
COPY database /app/database
COPY deploy/render_demo_start.py /app/deploy/render_demo_start.py
USER 10001
EXPOSE 10000
CMD ["python", "deploy/render_demo_start.py"]
