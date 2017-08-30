/*globals Spinner, reqwest, store */

var dallinger = (function () {
  var dlgr = {};

  dlgr.getUrlParameter = function getUrlParameter(sParam) {
    var sPageURL = decodeURIComponent(window.location.search.substring(1)),
      sURLVariables = sPageURL.split('&'),
      sParameterName,
      i;

    for (i = 0; i < sURLVariables.length; i++) {
      sParameterName = sURLVariables[i].split('=');
      if (sParameterName[0] === sParam) {
        return sParameterName[1] === undefined ? true : sParameterName[1];
      }
    }
  };

  dlgr.identity = {
    hitId: dlgr.getUrlParameter('hit_id'),
    workerId: dlgr.getUrlParameter('worker_id'),
    assignmentId: dlgr.getUrlParameter('assignment_id'),
    mode: dlgr.getUrlParameter('mode'),
    participantId: dlgr.getUrlParameter('participant_id')
  };

  dlgr.submitQuestionnaire = function (name) {
    var formSerialized = $("form").serializeArray(),
      formDict = {},
      deferred = $.Deferred();

    formSerialized.forEach(function (field) {
      formDict[field.name] = field.value;
    });

    reqwest({
      method: "post",
      url: "/question/" + dlgr.identity.participantId,
      data: {
        question: name || "questionnaire",
        number: 1,
        response: JSON.stringify(formDict)
      },
      type: "json",
      success: function (resp) {
        deferred.resolve();
      },
      error: function (err) {
        deferred.reject();
        var errorResponse = JSON.parse(err.response);
        $("body").html(errorResponse.html);
      }
    });

    return deferred;
  };

  dlgr.BusyForm = (function () {
    /**
    Loads a spinner as a visual cue that something is happening
    and disables any jQuery objects passed to freeze().
    **/

    var defaults = {
      spinnerSettings: {scale: 1.5}, // See http://spin.js.org/ for all settings
      spinnerID: 'spinner'  // ID for HTML element where spinner will be inserted
    };

    var BusyForm = function (options) {
      if (!(this instanceof BusyForm)) {
        return new BusyForm(options);
      }
      var settings = $.extend(true, {}, defaults, options);
      this.spinner = new Spinner(settings.spinnerSettings);
      this.target = document.getElementById(settings.spinnerID);
      if (this.target === null) {
        throw new Error(
          'Target HTML element for spinner with ID "' + settings.spinnerID +
          '" does not exist.');
      }
      this.$elements = [];
    };

    BusyForm.prototype.freeze = function ($elements) {
      this.$elements = $elements;
      this.$elements.forEach(function ($element) {
        $element.attr("disabled", true);
      });
      this.spinner.spin(this.target);
    };

    BusyForm.prototype.unfreeze = function () {
      this.$elements.forEach(function ($element) {
        $element.attr("disabled", false);
      });
      this.spinner.stop();
      this.$elements = [];
    };

    return BusyForm;
  }());

  // stop people leaving the page, but only if desired by experiment
  dlgr.allowExitOnce = false;
  dlgr.preventExit = false;
  window.addEventListener('beforeunload', function(e) {
    if (dlgr.preventExit && !dlgr.allowExitOnce) {
      var returnValue = "Warning: the study is not yet finished. " +
        "Closing the window, refreshing the page or navigating elsewhere " +
        "might prevent you from finishing the experiment.";
      e.returnValue = returnValue;
      return returnValue;
    } else {
      dlgr.allowExitOnce = false;
      return undefined;
    }
  });
  // allow actions to leave the page
  dlgr.allowExit = function() {
    dlgr.allowExitOnce = true;
  };

  // advance the participant to a given html page
  dlgr.goToPage = function(page) {
    window.location = "/" + page + "?participant_id=" + dlgr.identity.participantId;
  };

  // report assignment complete
  dlgr.submitAssignment = function() {
    var deferred = $.Deferred();
    reqwest({
      url: "/participant/" + dlgr.identity.participantId,
      method: "get",
      type: "json",
      success: function (resp) {
        dlgr.identity.mode = resp.participant.mode;
        dlgr.identity.hitId = resp.participant.hit_id;
        dlgr.identity.assignmentId = resp.participant.assignment_id;
        dlgr.identity.workerId = resp.participant.worker_id;
        var workerComplete = '/worker_complete';
        reqwest({
          url: workerComplete,
          method: "get",
          type: "json",
          data: {
            "uniqueId": dlgr.identity.workerId + ":" + dlgr.identity.assignmentId
          },
          success: function (resp) {
            deferred.resolve();
            dallinger.allowExit();
            window.location = "/complete";
          },
          error: function (err) {
            deferred.reject();
            console.log(err);
            var errorResponse = JSON.parse(err.response);
            $("body").html(errorResponse.html);
          }
        });
      }
    });
    return deferred;
  };

  // make a new participant
  dlgr.createParticipant = function() {
    var url;
    // check if the local store is available, and if so, use it.
    if (typeof store !== "undefined") {
      url = "/participant/" +
        store.get("worker_id") + "/" +
        store.get("hit_id") + "/" +
        store.get("assignment_id") + "/" +
        store.get("mode");
    } else {
      url = "/participant/" +
        dlgr.identity.workerId + "/" +
        dlgr.identity.hitId + "/" +
        dlgr.identity.assignmentId + "/" +
        dlgr.identity.mode;
    }

    var deferred = $.Deferred();
    if (dlgr.identity.participantId !== undefined && dlgr.identity.participantId !== 'undefined') {
      deferred.resolve();
    } else {
      $(function () {
        $('.btn-success').prop('disabled', true);
        reqwest({
          url: url,
          method: "post",
          type: "json",
          success: function(resp) {
            console.log(resp);
            $('.btn-success').prop('disabled', false);
            dlgr.identity.participantId = resp.participant.id;
            if (resp.quorum) {
              if (resp.quorum.n === resp.quorum.q) {
                // reached quorum; resolve immediately
                deferred.resolve();
              } else {
                // wait for quorum, then resolve
                dlgr.updateProgressBar(resp.quorum.n, resp.quorum.q);
                dlgr.waitForQuorum().done(function () {
                  deferred.resolve();
                });
              }
            } else {
              // no quorum; resolve immediately
              deferred.resolve();
            }
          },
          error: function (err) {
            var errorResponse = JSON.parse(err.response);
            $("body").html(errorResponse.html);
          }
        });
      });
    }
    return deferred;
  };

  dlgr.createAgent = function () {
    var deferred = $.Deferred();
    reqwest({
      url: "/node/" + dallinger.identity.participantId,
      method: 'post',
      type: 'json',
      success: function (resp) { deferred.resolve(resp); },
      error: function (err) {
        console.log(err);
        var errorResponse = JSON.parse(err.response);
        if (errorResponse.hasOwnProperty("html")) {
          $("body").html(errorResponse.html);
        } else {
          deferred.reject(err);
        }
      }
    });
    return deferred;
  };

  dlgr.createInfo = function (nodeId, data) {
    var deferred = $.Deferred();
    reqwest({
      url: "/info/" + nodeId,
      method: 'post',
      data: data,
      success: function (resp) { deferred.resolve(resp); },
      error: function (err) { deferred.reject(err); }
    });
    return deferred;
  };

  dlgr.getReceivedInfo = function (nodeId) {
    var deferred = $.Deferred();
    reqwest({
      url: "/node/" + nodeId + "/received_infos",
      method: 'get',
      type: 'json',
      success: function (resp) { deferred.resolve(resp); },
      error: function (err) { deferred.reject(err); }
    });
    return deferred;
  }

  dlgr.submitResponses = function () {
    dlgr.submitNextResponse(0);
    dlgr.submitAssignment();
  };

  dlgr.submitNextResponse = function (n) {
    // Get all the ids.
    var ids = $("form .question select, input, textarea").map(
      function () {
        return $(this).attr("id");
      }
    );

    reqwest({
      url: "/question/" + dlgr.identity.participantId,
      method: "post",
      type: "json",
      data: {
        question: $("#" + ids[n]).attr("name"),
        number: n + 1,
        response: $("#" + ids[n]).val()
      },
      success: function() {
        if (n <= ids.length) {
          dlgr.submitNextResponse(n + 1);
        }
      },
      error: function (err) {
        var errorResponse = JSON.parse(err.response);
        if (errorResponse.hasOwnProperty("html")) {
          $("body").html(errorResponse.html);
        }
      }
    });
  };

  dlgr.waitForQuorum = function () {
    var ws_scheme = (window.location.protocol === "https:") ? 'wss://' : 'ws://';
    var socket = new ReconnectingWebSocket(ws_scheme + location.host + "/chat?channel=quorum");
    var deferred = $.Deferred();
    socket.onmessage = function (msg) {
      if (msg.data.indexOf('quorum:') !== 0) { return; }
      var data = JSON.parse(msg.data.substring(7));
      var n = data.n;
      var quorum = data.q;
      dlgr.updateProgressBar(n, quorum);
      if (n >= quorum) {
        deferred.resolve();
      }
    };
    return deferred;
  };

  dlgr.updateProgressBar = function (value, total) {
    var percent = Math.round((value / total) * 100.0) + '%';
    $("#waiting-progress-bar").css("width", percent);
    $("#progress-percentage").text(percent);
  };

  return dlgr;
}());
