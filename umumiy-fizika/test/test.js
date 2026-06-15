import { renderMultipleChoiceTest }
from "../../js/multiple-choice-test.js";

const params = new URLSearchParams(location.search);

const id = params.get("id");

const response =
    await fetch(`test-${id}.json`);

const data =
    await response.json();

document.title =
    `${data.title} | OliyFizika.uz`;

document.getElementById("pageTitle")
    .textContent = data.title;

document.getElementById("pageSubtitle")
    .textContent = data.subtitle;

document.getElementById("backLink")
    .href = data.backUrl;

renderMultipleChoiceTest({
    questions: data.questions,
    form: document.getElementById("questions"),
    result: document.getElementById("result"),
    submitButton:
        document.getElementById("submitBtn"),
    unlockLesson: data.unlockLesson
});