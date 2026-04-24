FROM python:3.11-slim

WORKDIR /app
COPY . /app

RUN python -m pip install --no-cache-dir -e ".[dev]"

ENV CHEK_APP_CLI_HOME=/config
ENTRYPOINT ["chek"]
CMD ["manifest"]
