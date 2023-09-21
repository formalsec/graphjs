function add_setting_to_conf
{
    local _setting=${1}
    local _value=${2}
    local _neo4j_home=${3}

    if grep -q -F "${_setting}=" "${_neo4j_home}"/conf/neo4j.conf; then
        # Remove any lines containing the setting already
        sed --in-place "/^${_setting}=.*/d" "${_neo4j_home}"/conf/neo4j.conf
    fi
    # Then always append setting to file
    echo "${_setting}=${_value}" >> "${_neo4j_home}"/conf/neo4j.conf
}

add_setting_to_conf "dbms.security.auth_enabled" "false" "/var/lib/neo4j"