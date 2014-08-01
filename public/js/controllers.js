/* Controllers */

(function() {
    'use strict';
    angular.module('photoshare.controllers', ['photoshare.services'])
        .controller('AppCtrl', ['$scope',
            '$location',
            '$timeout',
            'Session',
            'Auth',
            'MessageQueue',
            'Alert',
            function($scope,
                $location,
                $timeout,
                Session,
                Auth,
                MessageQueue,
                Alert) {

                $scope.session = Session;
                $scope.alert = Alert;
                $scope.mq = MessageQueue;
                $scope.searchQuery = "";
                $scope.currentUrl = $location.path();

                Session.init(Auth);

                $scope.$watchCollection('alert.messages', function(newValue, oldValue) {
                    $timeout(function() {
                        Alert.dismissLast();
                    }, 3000);
                });

                $scope.$watch('mq.newMessage', function(newValue, oldValue) {
                    if (newValue) {
                        Alert.info(newValue);
                    }
                });

                $scope.$on('$routeChangeStart', function(event, current, previous) {
                    if (current.loginRequired) {
                        Session.check();
                    }
                });

                $scope.$on('$locationChangeStart', function(next, current) {
                    $scope.currentUrl = current;
                });

                $scope.logout = function() {
                    Session.logout().then(function() {
                        $location.path("/popular");
                    });
                };

                $scope.login = function() {
                    Session.setLastLoginUrl();
                    $location.path("/login");
                };

                $scope.doSearch = function() {
                    $location.path("/search/" + $scope.searchQuery);
                    $scope.searchQuery = "";
                };
            }
        ])

    .controller('FrontCtrl', ['$scope', '$location', 'Photo',
        function($scope, $location, Photo) {

            $scope.pageLoaded = false;
            $scope.photos = [];

            Photo.query({
                orderBy: "votes",
                page: 1
            }, function(response) {
                $scope.photos = response.photos;
            });

            $scope.go = function(photo) {
                $location.path("/detail/" + photo.id);
            }

        }
    ])
        .controller('ListCtrl', ['$scope',
            '$state',
            '$stateParams',
            'Photo',
            function($scope,
                $state,
                $stateParams,
                Photo) {
                var pageLoaded = false,
                    apiCall = null,
                    q = $stateParams.q || "",
                    ownerID = $stateParams.ownerID || "",
                    ownerName = $stateParams.ownerName || "",
                    tag = $stateParams.tag || "",
                    orderBy = "";

                if ($state.current.data && $state.current.data.orderBy) {
                    orderBy = $state.current.data.orderBy;
                }
                $scope.photos = [];
                $scope.tag = tag;
                $scope.searchQuery = q;
                $scope.ownerName = ownerName;
                $scope.searchComplete = false;

                $scope.showHeader = false;

                $scope.total = 0;
                $scope.currentPage = 1;
                $scope.showPagination = false;

                if (q) {
                    apiCall = function(page) {
                        return Photo.search({
                            q: q,
                            page: page
                        });
                    };
                    $scope.showHeader = true;
                } else if (tag) {
                    apiCall = function(page) {
                        return Photo.search({
                            q: "#" + tag,
                            page: page
                        });
                    };
                    $scope.showHeader = true;
                } else if (ownerID) {
                    apiCall = function(page) {
                        return Photo.byOwner({
                            ownerID: ownerID,
                            page: page
                        });
                    };
                    $scope.showHeader = true;
                } else {
                    apiCall = function(page) {
                        return Photo.query({
                            orderBy: orderBy,
                            page: page
                        });
                    };
                }

                $scope.nextPage = function() {
                    pageLoaded = false;
                    apiCall($scope.currentPage).$promise.then(function(result) {
                        if (result.total == 1) {
                            $scope.getDetail(result.photos[0]);
                        }
                        $scope.pageLoaded = true;
                        $scope.searchComplete = true;
                        $scope.photos = result.photos;
                        $scope.total = result.total;
                        $scope.showPagination = result.numPages > 1;
                    });
                };
                $scope.nextPage();

                $scope.getDetail = function(photo) {
                    $state.go('detail', {
                        id: photo.id
                    });
                };

            }
        ])

    .controller('DetailCtrl', ['$scope',
        '$stateParams',
        '$location',
        '$window',
        'Photo',
        'Tag',
        'Session',
        'Alert',
        function($scope,
            $stateParams,
            $location,
            $window,
            Photo,
            Tag,
            Session,
            Alert) {

            $scope.photo = null;
            $scope.editTitle = false;
            $scope.editTags = false;
            $scope.pageLoaded = false;

            function calcScore() {
                if ($scope.photo) {
                    $scope.photo.score = $scope.photo.upVotes - $scope.photo.downVotes;
                }
            }

            $scope.$watch('photo.upVotes', function() {
                calcScore();
            });
            $scope.$watch('photo.downVotes', function() {
                calcScore();
            });

            Photo.get({
                id: $stateParams.id
            }).$promise.then(function(photo) {
                $scope.photo = photo;
                $scope.photo.taglist = $scope.photo.tags ? $scope.photo.tags.join(" ") : "";
                $scope.pageLoaded = true;
                calcScore();
            }, function() {
                Alert.danger("This photo no longer exists, or cannot be found");
                $window.history.back();
            });

            $scope.voteUp = function() {
                if (!$scope.photo.perms.vote) {
                    return;
                }
                $scope.photo.perms.vote = false;
                $scope.photo.upVotes += 1;
                Photo.upvote({
                    id: $scope.photo.id
                });
            };

            $scope.voteDown = function() {
                if (!$scope.photo.perms.vote) {
                    return;
                }
                $scope.photo.perms.vote = false;
                $scope.photo.downVotes += 1;
                Photo.downvote({
                    id: $scope.photo.id
                });
            };

            $scope.deletePhoto = function() {
                if (!$scope.photo.perms.delete || !$window.confirm('You sure you want to delete this?')) {
                    return;
                }
                $scope.photo.$delete(function() {
                    Alert.success('Your photo has been deleted');
                    $window.history.back();
                });
            };
            $scope.showEditForm = function() {
                if ($scope.photo.perms.edit) {
                    $scope.editTitle = true;
                }
            };
            $scope.hideEditForm = function() {
                $scope.editTitle = false;
            };
            $scope.showEditTagsForm = function() {
                if ($scope.photo.perms.edit) {
                    $scope.editTags = true;
                }
            };
            $scope.hideEditTagsForm = function() {
                $scope.editTags = false;
            };
            $scope.updateTitle = function() {
                Photo.updateTitle({
                    id: $scope.photo.id,
                    title: $scope.photo.title
                });
                $scope.editTitle = false;
            };
            $scope.updateTags = function() {
                var taglist = $scope.photo.taglist || "";
                if (!taglist) {
                    $scope.photo.tags = [];
                } else {
                    $scope.photo.tags = taglist.trim().split(" ");
                }
                Photo.updateTags({
                    id: $scope.photo.id,
                    tags: $scope.photo.tags
                });
                $scope.editTags = false;
            };

        }
    ])

    .controller('TagsCtrl', ['$scope',
        '$location',
        '$filter',
        'Tag',
        function($scope, $location, $filter, Tag) {
            $scope.tags = [];
            $scope.orderField = '-numPhotos';
            $scope.pageLoaded = false;

            Tag.query().$promise.then(function(response) {
                $scope.tags = response;
                $scope.pageLoaded = true;
                $scope.filteredTags = $scope.tags;
            });

            $scope.filterTags = function() {
                $scope.filteredTags = $filter('filter')($scope.tags, {
                    name: $scope.tagFilter.name
                });

                if ($scope.filteredTags.length === 1) {
                    $scope.doSearch($scope.filteredTags[0].name);
                }
            };

            $scope.doSearch = function(tag) {
                $location.path("/tag/" + tag);
            };

            $scope.orderTags = function(field) {
                $scope.orderField = field;
            };

        }
    ])

    .controller('UploadCtrl', ['$scope',
        '$location',
        '$window',
        'Session',
        'Alert',
        'Photo',
        function($scope,
            $location,
            $window,
            Session,
            Alert,
            Photo) {
            //Session.check();
            $scope.newPhoto = new Photo();
            $scope.upload = null;
            $scope.formDisabled = false;
            $scope.formErrors = {};
            $scope.uploadPhoto = function(addAnother) {
                $scope.formDisabled = true;
                var taglist = $scope.newPhoto.taglist || "";
                if (!taglist) {
                    $scope.newPhoto.tags = [];
                } else {
                    $scope.newPhoto.tags = taglist.trim().split(" ");
                }
                $scope.newPhoto.$save(
                    function(response) {
                        $scope.newPhoto = new Photo();
                        Alert.success('Your photo has been uploaded');
                        if (addAnother) {
                            $scope.upload = null;
                            $scope.formDisabled = false;
                            $window.document.getElementById('photo_input').value = '';
                        } else {
                            $location.path("/detail/" + response.id);
                        }
                    },
                    function(result) {
                        if (result.data) {
                            $scope.formErrors = result.data.errors;
                        }
                        $scope.formDisabled = false;
                    }
                );
            };

        }
    ])

    .controller('LoginCtrl', ['$scope',
        '$location',
        '$window',
        '$http',
        'Session',
        'Auth',
        'Alert',
        'authTokenHeader',
        function($scope,
            $location,
            $window,
            $http,
            Session,
            Auth,
            Alert,
            authTokenHeader) {

            // tbd wrap in service
            $scope.oauth2Login = function(provider) {
                $http.get('/api/auth/oauth2/' + provider + '/url').success(function(response) {
                    $window.location.href = response;
                });
            };
            $scope.formData = new Auth();
            $scope.login = function() {
                $scope.formData.$save(function(result, headers) {
                    $scope.formData = new Auth();
                    if (result.loggedIn) {
                        Session.login(result, headers(authTokenHeader));
                        Alert.success("Welcome back, " + result.name);
                        var path = Session.getLastLoginUrl() || "/popular";
                        $location.path(path);
                    }
                });
            };
        }
    ])

    .controller('RecoverPassCtrl', ['$scope',
        '$location',
        'Auth',
        'Alert',
        function($scope, $location, Auth, Alert) {

            $scope.formData = {};

            $scope.recoverPassword = function() {
                Auth.recoverPassword({}, $scope.formData, function() {
                    Alert.success("Check your email for a link to change your password");
                    $location.path("/");
                }, function(result) {
                    Alert.danger(result.data);
                });
            };

        }
    ])

    .controller('ChangePassCtrl', ['$scope',
        '$location',
        'Auth',
        'Session',
        'Alert',
        function($scope, $location, Auth, Session, Alert) {

            var code = $location.search().code;
            $scope.formData = {};

            if (code) {
                $scope.formData.code = code;
            } else {
                Session.check();
            }

            $scope.changePassword = function() {
                Auth.changePassword({}, $scope.formData, function() {
                    Alert.success("Your password has been updated");
                    if (!Session.loggedIn) {
                        $location.path("/login");
                    } else {
                        $location.path("/");
                    }
                }, function(result) {
                    Alert.danger(result.data || "Sorry, an error occurred");
                });
            };
        }
    ])

    .controller('SignupCtrl', ['$scope',
        '$location',
        'Auth',
        'Session',
        'Alert',
        'authTokenHeader',
        function($scope,
            $location,
            Auth,
            Session,
            Alert,
            authTokenHeader) {

            $scope.formData = {};
            $scope.formErrors = {};
            $scope.signup = function() {
                Auth.signup({}, $scope.formData, function(result, headers) {
                    Session.login(result, headers(authTokenHeader));
                    $scope.formData = {};
                    Alert.success("Welcome, " + result.name);
                    $location.path("/popular");
                }, function(result) {
                    $scope.formErrors = result.data.errors;
                });
            };
        }
    ]);
})();
