/*
CSC3916 HW4
File: server.js
Description: Web API scaffolding for Movie API
 */

var express = require('express');
var bodyParser = require('body-parser');
var passport = require('passport');
var authJwtController = require('./auth_jwt');
var jwt = require('jsonwebtoken');
var cors = require('cors');

var User = require('./Users');
var Movie = require('./Movies');
var Review = require('./Reviews');

var app = express();
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(passport.initialize());

var router = express.Router();

function getJSONObjectForMovieRequirement(req) {
    var json = {
        headers: "No headers",
        key: process.env.UNIQUE_KEY,
        body: "No body"
    };

    if (req.body != null) {
        json.body = req.body;
    }

    if (req.headers != null) {
        json.headers = req.headers;
    }

    return json;
}

router.post('/signup', function(req, res) {
    if (!req.body.username || !req.body.password) {
        res.json({success: false, msg: 'Please include both username and password to signup.'})
    } else {
        var user = new User();
        user.name = req.body.name;
        user.username = req.body.username;
        user.password = req.body.password;

        user.save(function(err){
            if (err) {
                if (err.code == 11000)
                    return res.json({ success: false, message: 'A user with that username already exists.'});
                else
                    return res.json(err);
            }

            res.json({success: true, msg: 'Successfully created new user.'})
        });
    }
});

router.post('/signin', function (req, res) {
    var userNew = new User();
    userNew.username = req.body.username;
    userNew.password = req.body.password;

    User.findOne({ username: userNew.username }).select('name username password').exec(function(err, user) {
        if (err) {
            res.send(err);
        }

        user.comparePassword(userNew.password, function(isMatch) {
            if (isMatch) {
                var userToken = { id: user.id, username: user.username };
                var token = jwt.sign(userToken, process.env.SECRET_KEY);
                res.json ({success: true, token: 'JWT ' + token});
            }
            else {
                res.status(401).send({success: false, msg: 'Authentication failed.'});
            }
        })
    })
});

router.route('/movies')

    // Return all movies in the DB.
    .get(authJwtController.isAuthenticated, function (req, res) {

        if (req.query.reviews === 'true') {
            Movie.aggregate()
                .lookup({
                    from: 'reviews',
                    localField: 'title',
                    foreignField: 'title',
                    as: 'reviews'
                })
                .exec(function(err, result) {
                    res.send(result);
                })
        }

        else {
            Movie.find(function (err, movie) {
                if (err) res.json({success: false, message: "Error returning movies."});
                res.json(movie);
            })
        }
    })

    // Save a new movie to the database
    .post(authJwtController.isAuthenticated, function (req, res) {
        console.log(req.body);
        var movie = new Movie();
        movie.title = req.body.title;
        movie.yearReleased = req.body.yearReleased;
        movie.genre = req.body.genre;
        movie.actors = req.body.actors;
        movie.imgURL = req.body.imgURL;

        Movie.findOne({title: req.body.title}, function(err, fnd) {
            if(err){
                return res.json({success: false, message: "Error saving movie."});
            }
            else if(fnd){
                return res.json({success: false, message: "The movie already exists."});
            }
            else if (movie.actors.length < 3){
                return res.json({success: false, message: "Must have at least 3 actors"});
            }
            else{
                movie.save(function (err) {
                    if(err){
                        return res.json({success: false, message: "Error saving movie."});
                    }
                    else{
                        res.status(200).json({message: "Movie has been saved."});
                    }
                })
            }
        });
    })

    // Delete one movie.
    .delete(authJwtController.isAuthenticated, function (req, res){
        Movie.findOneAndDelete({title: req.body.title}, function (err, movie) {
            if (err)
            {
                res.status(400).json({message: "Error deleting movie.", msg: err})
            }
            else if(movie == null)
            {
                return res.status(400).json({success: false, message : "Error deleting movie. Title was not found."})
            }
            else
                res.json({message :"The movie has been deleted"})
        })
    })

    // Update a movie.
    .put(authJwtController.isAuthenticated, function (req, res) {
            console.log(req.body);
            res = res.status(200);
            if (req.get('Content-Type')) {
                res = res.type(req.get('Content-Type'));
            }

            Movie.findOneAndUpdate({title: req.body.title}, req.body, function (err, mov) {
                if (err)
                {
                    return res.status(400).json(err);
                }

                return res.json({success: true, message: 'Movie has been updated.'})
            })
        }
    )

router.route('/movies/:movieId')
    .get(authJwtController.isAuthenticated, function (req, res) {
        var getReview;

        if(req.query.reviews === "true"){
            getReview = true;
        }

        var id = req.params.movieId;

        Movie.findById( id, function(err, movie) {
            if (err) res.send(err);
            else{
                if(getReview){
                    Movie.aggregate([
                        {
                            $match: {'_id': mongoose.Types.ObjectId(id)}
                        },
                        {
                            $lookup:{
                                from: 'reviews',
                                foreignField: 'movieId',
                                localField: '_id',
                                as: 'reviews'
                            }
                        },
                        {
                            $addFields: {
                                avgRating: { $avg: "$reviews.rating" }
                            }
                        },
                        {
                            $sort:{
                                rating : -1
                            }
                        }
                    ], function (err, output) {
                        if(err){
                            return res.json({ success: false, message: 'Error' })
                        }
                        else{
                            res.json(output[0]);
                        }
                    })
                }
                else{
                    if(movie !== null) {
                        return res.json(movie);
                    } else {
                        return res.json({ success: false, message: 'Movie not found.' })
                    }
                }
            }
        });
    });

router.route('/reviews')
    .get(authJwtController.isAuthenticated, function(req,res) {
        Review.find(function (err, review) {
            if (err) res.json({success: false, message: "Error returning movies."});
            res.json(review);
        })
    })

    .post(authJwtController.isAuthenticated, function(req,res){
        console.log(req.body);

        if(!req.body.userReview || !req.body.rating || !req.body.title){

            res.json({success: false, message: 'Request must include title, rating, and a review.'});

        }

        Movie.findOne({title: req.body.title}, function (err, movie) {

            if(err) {
                res.send(err);
            }
            else if (!movie) {
                res.json({success: false, message: 'Cannot find movie.'});
            }

            else {

                var review = new Review();

                review.userReview = req.body.userReview;
                review.rating = req.body.rating;
                review.title = req.body.title;

                // Get username decoded from token
                var usrtkn = req.headers.authorization;
                var token = usrtkn.split(' ');
                var decoded = jwt.verify(token[1], process.env.SECRET_KEY);

                review.username = decoded.username;

                review.save(function(err) {

                    if (err) {
                        res.json(err);
                    }
                    else{
                        res.json({ success: true, message: 'Review saved.' })
                    }
                })
            }
        });
    });

app.use('/', router);
app.listen(process.env.PORT || 8080);
module.exports = app; // for testing only