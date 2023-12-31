FROM openjdk:11-jdk-slim

# ENV NEO4J_SHA256=0f074e2d84c265fbb066ad648b52c62c623d1f1b18b9d4d04356d46726853c96 \
#     NEO4J_TARBALL=neo4j-community-4.2.1-unix.tar.gz \
#     NEO4J_EDITION=community \
#     NEO4J_HOME="/var/lib/neo4j"
#ARG NEO4J_URI=https://dist.neo4j.org/neo4j-community-4.2.1-unix.tar.gz

ENV NEO4J_SHA256=cf50b123f193bf438833ef769043bd472a284a6b4e9415a9985d7268f452d7e3 \
     NEO4J_TARBALL=neo4j-community-4.4.13-unix.tar.gz \
     NEO4J_EDITION=community \
     NEO4J_HOME="/var/lib/neo4j"
ARG NEO4J_URI=https://dist.neo4j.org/neo4j-community-4.4.13-unix.tar.gz
ARG TINI_SHA256="12d20136605531b09a2c2dac02ccee85e1b874eb322ef6baf7561cd93f93c855"
ARG TINI_URI="https://github.com/krallin/tini/releases/download/v0.18.0/tini"

RUN addgroup --gid 7474 --system neo4j && adduser --uid 7474 --system --no-create-home --home "${NEO4J_HOME}" --ingroup neo4j neo4j

RUN apt-get update \
    && apt-get install -y curl wget gosu jq time python3 python3-pip\
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
    && rm -rf /var/lib/apt/lists/* \
    && apt-get -y purge --auto-remove curl \
    && touch "${NEO4J_HOME}"/data/apoc.conf \
    && echo -e "apoc.export.file.enabled=true\napoc.import.file.enabled=true\napoc.import.file.use_neo4j_config=true" >> "${NEO4J_HOME}"/data/apoc.conf

ENV PATH "${NEO4J_HOME}"/bin:$PATH

WORKDIR "${NEO4J_HOME}"

COPY docker-entrypoint.sh /docker-entrypoint.sh
COPY import.sh "${NEO4J_HOME}"/import.sh

EXPOSE 7474 7473 7687

ENTRYPOINT ["/sbin/tini", "-g", "--", "/docker-entrypoint.sh"]
CMD ["neo4j"]