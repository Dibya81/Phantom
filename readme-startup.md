# 1. Setup Python Environment and Backend
python3 -m venv venv && \
source venv/bin/activate && \
pip install --upgrade pip && \
pip install -r agent/requirements.txt -r blockchain/requirements.txt -r intelligence/requirements.txt && \
\
# 2. Setup Frontend
cd agent/frontend && npm install && cd ../../ && \
\
# 3. Setup Blockchain Service
cd blockchain/vc_issuer && npm install && cd ../../
