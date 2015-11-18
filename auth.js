var auth = require('basic-auth');
var database = require('./database');
var bcrypt = require('bcryptjs');
var assert = require('assert');
var Promise = require('bluebird');

var checkPassword = Promise.promisify(bcrypt.compare);

exports.requireLevel = function (level) {
    assert(level == 'logged_in' || level == 'presenter', 'Invalid access level: ' + level);
    
    return function (req, res, next) {
        var credentials = auth(req);
        
        function invalidCredentials() {
            res.status(401).send('Valid credentials are required');
        }
        
        // If credentials are missing, return error.
        if (!credentials) {
            return invalidCredentials();
        }
        
        var email = credentials.name;
        var password = credentials.pass;
        
        database.query(
            "SELECT id, avatar, verified, presenter, email, password_hash, student_id "+
            "FROM users WHERE email = $1",
            [email])
        .then(function (results) {
            // If account does not exist, return error.
            if (results.length == 0) {
                return invalidCredentials();
            }
            
            var user = results[0];
            var hash = user.password_hash;
            var verified = user.verified;
            var presenter = user.presenter;
            
            // If the account has not been verified, return error.
            if (!verified) {
                return invalidCredentials();
            }
            
            return checkPassword(password, hash).then(function (valid) {
                // If the password supplied is not correct, return error.
                if (!valid) {
                    return invalidCredentials();
                }
                
                // If the access level is 'presenter' and they are not a presenter, return error.
                if (level == 'presenter' && !presenter) {
                    return invalidCredentials();
                }
                
                req.user = user;
                next();
            })
        })
        .catch(next);
    }
}

var genSalt = Promise.promisify(bcrypt.genSalt);
var hash = Promise.promisify(bcrypt.hash);

exports.hashPassword = function (password) {
    return genSalt(10).then(function (salt) {
        return hash(password, salt);
    });
}
