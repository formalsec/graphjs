ARG BASE_OS="ubuntu:22.04"
FROM ${BASE_OS}

ENV DEBIAN_FRONTEND=noninteractive

SHELL ["/bin/bash", "-c"]

RUN apt-get update && \
    apt-get install -y curl ca-certificates gnupg wget graphviz unzip software-properties-common sudo

# Install Node.js
RUN mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key | gpg --dearmor -o /etc/apt/keyrings/nodesource.gpg \
    && echo "deb [signed-by=/etc/apt/keyrings/nodesource.gpg] https://deb.nodesource.com/node_21.x nodistro main" | tee /etc/apt/sources.list.d/nodesource.list \
    && apt update \
    && apt install nodejs -y

# Install Neo4j
ENV NEO4J_HOME="/var/lib/neo4j"
RUN wget -O - https://debian.neo4j.com/neotechnology.gpg.key | apt-key add - \
    && echo 'deb https://debian.neo4j.com stable 5' | tee -a /etc/apt/sources.list.d/neo4j.list \
    && apt-get update \
    && apt-get install -y neo4j=1:5.9.0 \
    && echo dbms.security.auth_enabled=false >> /etc/neo4j/neo4j.conf \
    && chown -R neo4j:neo4j /var/lib/neo4j \
    && chown -R neo4j:neo4j /var/log/neo4j \
    && chmod -R g+rw /var/lib/neo4j \
    && chmod -R g+rw /var/log/neo4j

# Install Python 3.11
RUN add-apt-repository ppa:deadsnakes/ppa \
    && apt install python3.11 python3-pip python3.11-dev -y \
    && update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1 \
    && pip install --upgrade pip setuptools

# Clean up
RUN apt-get update && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Configure 'graphjs' user
RUN useradd -ms /bin/bash graphjs \
    && usermod -aG neo4j graphjs \
    && echo graphjs:graphjs | chpasswd \
    && cp /etc/sudoers /etc/sudoers.bak \
    && echo "graphjs ALL=(ALL) NOPASSWD: ALL" >> /etc/sudoers 

USER graphjs
WORKDIR /home/graphjs

# Build graphjs
COPY --chown=graphjs:graphjs ./ /home/graphjs
WORKDIR /home/graphjs
RUN ./setup.sh