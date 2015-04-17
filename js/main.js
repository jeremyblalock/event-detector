//////////////////////////////////////////////////////////
//                                                      //
//  Angular app + controller setup                      //
//                                                      //
//////////////////////////////////////////////////////////

var app = angular.module('eventsApp', []);


////////////////////////
//                    //
//  EventsController  //
//                    //
////////////////////////
app.controller('EventsController', function($scope) {

  $scope.url = '';
  $scope.loading = false;
  $scope.monthNames = ['Jan', 'Feb', 'March', 'April', 'May', 'June', 'July',
                       'Sep', 'Oct', 'Nov', 'Dec'];

  var eventFetcher = new EventFetcher();

  var fetchCallback = function(results) {
    $scope.results = results;
    $scope.loading = false;
    $scope.$apply();
  }

  var errCallback = function() {
    $scope.results = [];
    $scope.loading = false;
    $scope.$apply();
  }

  $scope.layoutClass = 'list';

  $scope.results = [];

  $scope.submit = function() {
    if ($scope.url) {
      $scope.loading = true;
      eventFetcher.fetch($scope.url, fetchCallback, errCallback);
    }
  };

  $scope.setLayout = function(layout) {
    $scope.layoutClass = layout;
  }

  $scope.timeFormat = function(hours) {
    console.log(hours);
    var newHours = (+hours + 11) % 12 + 1,
        suffix = hours < 12 ? 'AM':'PM';
    return newHours + ' ' + suffix;
  }

});
