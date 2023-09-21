FROM ubuntu:20.04

SHELL ["/bin/bash", "-c"]

# Set encodings
RUN apt-get clean && \
    apt-get update && \
    apt-get install -y locales locales-all

ENV LC_ALL en_US.UTF-8
ENV LANG en_US.UTF-8
ENV LANGUAGE en_US.UTF-8
RUN locale-gen en_US.UTF-8

# Install OpenJDK 11 for Neo4J
RUN apt-get update && \
    apt-get install -y openjdk-11-jdk && \
    apt-get clean;

# Fix certificate issues
RUN apt-get update && \
    apt-get install ca-certificates-java && \
    apt-get clean && \
    update-ca-certificates -f;

# Setup JAVA_HOME -- useful for docker commandline
ENV JAVA_HOME /usr/lib/jvm/java-11-openjdk-amd64/
RUN export JAVA_HOME

# Install Python3
RUN apt-get update && \
    apt-get install -y software-properties-common gcc && \
    add-apt-repository -y ppa:deadsnakes/ppa;

RUN apt-get update && \
    apt-get install -y python3.6 python3-pip;

# Install Neo4J
ENV NEO4J_SHA256=0f074e2d84c265fbb066ad648b52c62c623d1f1b18b9d4d04356d46726853c96 \
    NEO4J_TARBALL=neo4j-community-4.2.1-unix.tar.gz \
    NEO4J_EDITION=community \
    NEO4J_HOME="/var/lib/neo4j"
ARG NEO4J_URI=https://dist.neo4j.org/neo4j-community-4.2.1-unix.tar.gz
ARG TINI_SHA256="12d20136605531b09a2c2dac02ccee85e1b874eb322ef6baf7561cd93f93c855"
ARG TINI_URI="https://github.com/krallin/tini/releases/download/v0.18.0/tini"

RUN addgroup --gid 7474 --system neo4j && adduser --uid 7474 --system --no-create-home --home "${NEO4J_HOME}" --ingroup neo4j neo4j

RUN apt-get update \
    && apt-get install -y curl wget gosu jq time\
    && pip3 install neo4j\
    && curl -L --fail --silent --show-error ${TINI_URI} > /sbin/tini \
    && echo "${TINI_SHA256}  /sbin/tini" | sha256sum -c --strict --quiet \
    && chmod +x /sbin/tini \
    && curl --fail --silent --show-error --location --remote-name ${NEO4J_URI} \
    && echo "${NEO4J_SHA256}  ${NEO4J_TARBALL}" | sha256sum -c --strict --quiet \
    && tar --extract --file ${NEO4J_TARBALL} --directory /var/lib \
    && mv /var/lib/neo4j-* "${NEO4J_HOME}" \
    && rm ${NEO4J_TARBALL} \
    && mv "${NEO4J_HOME}"/data /data \
    && mv "${NEO4J_HOME}"/logs /logs \
    && chown -R neo4j:neo4j /data \
    && chmod -R 777 /data \
    && chown -R neo4j:neo4j /logs \
    && chmod -R 777 /logs \
    && chown -R neo4j:neo4j "${NEO4J_HOME}" \
    && chmod -R 777 "${NEO4J_HOME}" \
    && ln -s /data "${NEO4J_HOME}"/data \
    && ln -s /logs "${NEO4J_HOME}"/logs \
    && rm -rf /tmp/* \
    && rm -rf /var/lib/apt/lists/*

ENV PATH "${NEO4J_HOME}"/bin:$PATH

# ENV NEO4J_dbms_query__cache__size=0
# ENV NEO4J_apoc_export_file_enabled=true
# ENV NEO4J_apoc_import_file_enabled=true
# ENV NEO4J_apoc_import_file_use__neo4j__config=true

# COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY neo4j_configs.sh neo4j_configs.sh
RUN ./neo4j_configs.sh

EXPOSE 7474 7473 7687

# ENTRYPOINT ["/sbin/tini", "-g", "--", "/docker-entrypoint.sh"]

# Install Pip Requirements
COPY pip-requirements.txt pip-requirements.txt
RUN pip install -r pip-requirements.txt && \
    rm pip-requirements.txt

# Install Node.js with NVM
RUN curl -o- https://raw.githubusercontent.com/creationix/nvm/master/install.sh | bash
ENV NVM_DIR /root/.nvm

ENV NODE_VERSION 17.1.0
RUN source $NVM_DIR/nvm.sh && \
    nvm install $NODE_VERSION && \
    nvm alias default $NODE_VERSION && \
    nvm use default

ENV NODE_PATH $NVM_DIR/v$NODE_VERSION/lib/node_modules
ENV PATH      $NVM_DIR/v$NODE_VERSION/bin:$PATH

# Copy ExplodeJS project to Image
ADD explodejs.tar.gz /js-cpg

RUN chown -R root:root /js-cpg

WORKDIR /js-cpg/parser

RUN source $NVM_DIR/nvm.sh && \
    npm install

WORKDIR /js-cpg

COPY explodejs-run.sh /js-cpg/explodejs-run.sh

# ./explodejs-run.sh -f datasets/package-dataset/packages-src/request-2.88.2.tgz/request.js -c detection/config.json -o t.json -n t.js
# ./explodejs-run.sh -f datasets/package-dataset/packages-src/ms-2.1.3.tgz/index.js -c detection/config.json -o t.json -n t.js

RUN mkdir -p input_file
RUN mkdir -p output_files

# ENTRYPOINT "/bin/bash"
CMD ["./explodejs-run.sh", "-f", "input_file/index.js", "-c", "config.json", "-o", "output_files/index.json", "-n", "output_files/index.txt"]