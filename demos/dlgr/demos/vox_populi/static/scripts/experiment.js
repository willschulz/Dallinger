var my_node_id;

// Create the agent.
create_agent = function() {
  dallinger.createAgent()
    .done(function (resp) {
      my_node_id = resp.node.id;
      $("#response-form").show();
      $("#submit-response").removeClass('disabled');
      $("#submit-response").html('Submit');
    })
    .fail(function (rejection) {
      // A 403 is our signal that it's time to go to the questionnaire
      if (rejection.status === 403) {
        dallinger.allowExit();
        dallinger.goToPage('questionnaire');
      } else {
        dallinger.error(rejection);
      }
    });
};

submit_response = function() {
  $("#submit-response").addClass('disabled');
  $("#submit-response").html('Sending...');

  responses = {};
  for (var i = 0; i < 8; i++) {
    responses["Q" + (i + 1)] = $("#Q" + (i + 1)).val();
  }

  console.log(responses);

  dallinger.createInfo(my_node_id, {
    contents: JSON.stringify({
      "responses": responses
    }),
    info_type: "Info"
  }).done(function (resp) {
    create_agent();
  });
};
