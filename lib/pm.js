
const ASSERT = require("assert");
const PATH = require("path");
const FS = require("fs");
const SPAWN = require("child_process").spawn;
const Q = require("sourcemint-util-js/lib/q");
const TERM = require("sourcemint-util-js/lib/term");


exports.deploy = function(pm, options) {

    ASSERT(typeof options.targetPath !== "undefined", "`config.targetPath` is required!");

    // TODO: Set `"aws.amazon.com"` from `options.credentialsKey`.
    return pm.context.credentials.requestFor("aws.amazon.com", "PrivateSshKeyPath").then(function(PrivateSshKeyPath) {

        if (/^~\//.test(PrivateSshKeyPath)) {
            PrivateSshKeyPath = process.env.HOME + PrivateSshKeyPath.substring(1);
        }

        var sshOptions = [
            "-avz",
            "--compress",
            "--exclude",".*",
            "--copy-links",
            "-e", "ssh -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null -o IdentityFile=" + PrivateSshKeyPath
        ];
        // TODO: Don't sync `.deoloyignore`ed files.

        return call("rsync", pm.context.package.path, sshOptions.concat([
            ".",
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
