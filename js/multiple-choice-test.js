import { unlockMechanicsLesson } from "./mechanics-progress.js";

function createAnswer(questionIndex, answer, answerIndex){
  const label = document.createElement("label");
  label.className = "answer-option";

  const input = document.createElement("input");
  input.type = "radio";
  input.name = `q${questionIndex}`;
  input.value = String(answerIndex);

  const text = document.createElement("span");
  text.textContent = answer;

  label.append(input, text);
  return label;
}

export function renderMultipleChoiceTest({
  questions,
  form,
  result,
  submitButton,
  passPercent = 80,
  unlockLesson,
  redirectUrl = "mexanika.html",
  
}){
  if(!form || !result || !submitButton) return;

  const fragment = document.createDocumentFragment();

  questions.forEach((question, index)=>{
    const card = document.createElement("section");
    card.className = "question";

    const title = document.createElement("h2");
    title.textContent = `${index + 1}. ${question.text}`;
    card.appendChild(title);

    if(question.graphHtml){
      const graph = document.createElement("div");
      graph.className = "graph-box";
      graph.innerHTML = question.graphHtml;
      card.appendChild(graph);
    }

    if(question.image){
      const imageBox = document.createElement("div");
      imageBox.className = "graph-box";

      const image = document.createElement("img");

      image.src = question.image;
      image.alt = "Grafik";
      image.loading = "lazy";

      image.style.maxWidth = "100%";
      image.style.height = "auto";
      image.style.display = "block";
      image.style.margin = "0 auto";
      image.style.borderRadius = "10px";

      imageBox.appendChild(image);
      card.appendChild(imageBox);
    }

    const answers = document.createElement("div");
    answers.className = "answers";

    question.answers.forEach((answer, answerIndex)=>{
      answers.appendChild(createAnswer(index, answer, answerIndex));
    });

    card.appendChild(answers);
    fragment.appendChild(card);
  });

  form.replaceChildren(fragment);

  submitButton.addEventListener("click", ()=>{
    let score = 0;

    questions.forEach((question, index)=>{
      const selectedAnswer = form.querySelector(`input[name="q${index}"]:checked`);
      const labels = form.querySelectorAll(`input[name="q${index}"]`);

      labels.forEach((input)=>{
        const label = input.closest("label");
        label.classList.remove("correct", "wrong");

        if(Number(input.value) === question.correct){
          label.classList.add("correct");
        }
      });

      if(selectedAnswer && Number(selectedAnswer.value) === question.correct){
        score++;
      }else if(selectedAnswer){
        selectedAnswer.closest("label").classList.add("wrong");
      }
    });

    const percent = Math.round((score / questions.length) * 100);
    result.className = `result ${percent >= passPercent ? "success" : "error"}`;

    if(percent >= passPercent){
      unlockMechanicsLesson(unlockLesson);

      result.innerHTML = `
        <h2>🎉 Test yakunlandi</h2>
        <p><strong>To'g'ri javoblar:</strong> ${score}/${questions.length}</p>
        <p><strong>Natija:</strong> ${percent}%</p>
        <p style="color:#22c55e;">
        ✅ ${unlockLesson}-mavzu ochildi.
        </p>

        <br>

        <a href="${redirectUrl}"
          style="
            display:inline-block;
            padding:12px 24px;
            border-radius:12px;
            text-decoration:none;
            color:white;
            background:linear-gradient(135deg,#2563eb,#38bdf8);
            font-weight:600;
          ">
          Mavzularga qaytish
        </a>
      `;

      return;
    }

    result.innerHTML = `
      <h2>📊 Test yakunlandi</h2>

      <p><strong>To'g'ri javoblar:</strong>
        ${score}/${questions.length}
      </p>

      <p><strong>Natija:</strong>
        ${percent}%
      </p>

      <div style="
        height:14px;
        background:#1e293b;
        border-radius:20px;
        overflow:hidden;
        margin:15px 0;
      ">
        <div style="
          width:${percent}%;
          height:100%;
          background:#ef4444;
        "></div>
      </div>

      <p style="color:#ef4444">
        ❌ Keyingi mavzuni ochish uchun kamida
        ${passPercent}% talab qilinadi.
      </p>
    `;
  });
}
