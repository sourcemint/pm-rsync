
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const SPAWN = require("child_process").spawn;
const Q = require("sourcemint-util-js/lib/q");
const TERM = require("sourcemint-util-js/lib/term");
const CREDENTIALS_SSH = require("sourcemint-credentials-js/lib/ssh");


exports.deploy = function(pm, options) {

    ASSERT(typeof options.username !== "undefined", "`config.username` is required!");
    ASSERT(typeof options.hostname !== "undefined", "`config.hostname` is required!");
    ASSERT(typeof options.targetPath !== "undefined", "`config.targetPath` is required!");
    ASSERT(typeof options.sshPrivateKeyPath !== "undefined", "`config.sshPrivateKeyPath` is required!");

    var privateKey = new CREDENTIALS_SSH.PrivateKey(pm.context.credentials, options.sshPrivateKeyPath);

    return privateKey.ensureInAuthenticationAgent().then(function() {

        var sshOptions = [
            "-avz",
            "--compress",
            "--copy-links",
            "-e", "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentityFile=" + privateKey.path
        ];
        // TODO: Don't sync `.deoloyignore`ed files.

        return call("rsync", pm.context.package.path, sshOptions.concat([
            options.sourcePath || ".",
            options.username + "@" + options.hostname + ":" + options.targetPath
        ]));
    });
}


function call(bin, basePath, args, options) {

    options = options || {};

    var deferred = Q.defer();

    TERM.stdout.writenl("\0cyan(Running: " + bin + " " + args.join(" ") + " (cwd: " + basePath + ")\0)");

    var opts = {
        cwd: basePath
    };

    var proc = SPAWN(bin, args, opts);

    proc.on("error", function(err) {
        deferred.reject(err);
    });

    proc.stdout.on("data", function(data) {
        TERM.stdout.write(data.toString().replace(/\\n/g, "\n"));
    });

    var stderr = "";
    proc.stderr.on("data", function(data) {
        stderr += data.toString();
        TERM.stderr.write(data.toString());
    });
    proc.on("exit", function(code) {
        if (code !== 0) {
            var err = new Error("Error: " + stderr);
            if (/Connection refused/.test(stderr)) {
                err.code = "CONNECTION_REFUSED";
            }
            deferred.reject(err);
            return;
        }
        deferred.resolve();
    });

    if (typeof options.stdin !== "undefined") {
        proc.stdin.write(options.stdin);
        proc.stdin.end();
    }

    return deferred.promise;
}

