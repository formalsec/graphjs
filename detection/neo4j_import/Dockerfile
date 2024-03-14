FROM debian:bullseye-slim
ENV JAVA_HOME=/opt/java/openjdk
COPY --from=eclipse-temurin:17 $JAVA_HOME $JAVA_HOME
ENV PATH="${JAVA_HOME}/bin:${PATH}" \
    NEO4J_SHA256=5c8774afac24e8a43d1de94d7b200ed6ad27f51b6ab7802bc325f5d27992930a \
    NEO4J_TARBALL=neo4j-community-5.9.0-unix.tar.gz \
    NEO4J_EDITION=community \
    NEO4J_HOME="/var/lib/neo4j"
ARG NEO4J_URI=https://dist.neo4j.org/neo4j-community-5.9.0-unix.tar.gz

RUN addgroup --gid 7474 --system neo4j && adduser --uid 7474 --system --no-create-home --home "${NEO4J_HOME}" --ingroup neo4j neo4j

RUN apt update \
    && apt install -y curl gosu jq procps tini wget \
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

COPY ./utils/docker-entrypoint.sh /docker-entrypoint.sh
COPY ./utils/import.sh "${NEO4J_HOME}"/import.sh
RUN mkdir "${NEO4J_HOME}"/runs

ENTRYPOINT ["tini", "-g", "--", "/docker-entrypoint.sh"]
CMD ["neo4j"]