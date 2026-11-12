<p align="center">
  <img src="public/logo.svg" alt="Dropithmetic" width="420">
</p>

<h3 align="center">Bitwa zamków, w której wygrywa ten, kto liczy.</h3>

<p align="center">
  <a href="https://vakrim.github.io/dropithmetic/"><b>▶ Zagraj teraz w przeglądarce</b></a><br>
  <sub>Bez instalacji i bez logowania. Działa na komputerze i na tablecie.</sub>
</p>

<p align="center">
  <a href="https://vakrim.github.io/dropithmetic/"><img src="screenshots/bitwa.png" alt="Bitwa: niebieskie i pomarańczowe jednostki spadają między kołkami w stronę wrogiego zamku" width="800"></a>
</p>

## O co chodzi

Twój zamek stoi na górze planszy, zamek wroga na dole. Twoje jednostki spadają w dół, odbijają się od kołków i walczą z jednostkami przeciwnika. Każda, która doleci do wrogiego zamku, zabiera mu życie. Środkowe pole przy zamku liczy się podwójnie, a nawet poczwórnie.

Każdy zamek chroni mur z pięciu części. Mur odbija wrogie jednostki i sam też je rani, więc najpierw trzeba go rozbić.

Skąd wziąć złoto na nowe jednostki? Trzeba liczyć.

## Licz, żeby wygrać

<p align="center">
  <img src="screenshots/zadania.png" alt="Runda zadań: działanie 7 × 5, seria 13 i złoto zarobione w rundzie" width="800">
</p>

Zadania zbierają robotnicy. Na środku planszy leżą złote monety ze znakiem zapytania. Robotnik, który w nią trafi, przynosi Ci jedno zadanie. Robotnicy wroga zbierają te same monety, więc warto ich ubiec.

Co 10 sekund bitwa staje i zaczyna się runda: tyle działań, ile zadań zebrali robotnicy. Po ostatnim działaniu bitwa rusza dalej.

- Każda dobra odpowiedź daje złoto.
- Im dłuższa seria, tym większa nagroda i trudniejsze zadania.
- Każde rozwiązane zadanie zwiększa też stały dochód do końca poziomu.
- Błąd zabiera to jedno zadanie i zeruje serię, ale runda trwa dalej.
- Możesz wrócić do bitwy przed końcem rundy. Zarobione złoto dostajesz od razu, a pozostałe zadania czekają na następną rundę.

Zamek daje też stały dochód, nawet bez zadań.

Zadania rosną razem z serią: dodawanie i odejmowanie do 15, potem liczby dwucyfrowe i trzycyfrowe, przejście przez dziesiątkę, a na końcu tabliczka mnożenia i dzielenie.

## Buduj armię

Za zarobione złoto kupujesz budynki, a każdy z nich wysyła na planszę inne jednostki:

| Budynek    | Jednostka | Co robi                    |
| ---------- | --------- | -------------------------- |
| Koszary    | żołnierz  | mocno uderza               |
| Strzelnica | łucznik   | strzela do wrogów z daleka |
| Sztab      | generał   | przyspiesza i wzmacnia sojuszników |
| Warsztat   | machina   | niszczy zamek              |

Machina rozbija mur najszybciej. Złoto możesz też wydać na:

- **ulepszenie budynku**: kliknij budynek na taśmie, a będzie produkować szybciej (do trzech poziomów),
- **robotnika**: więcej robotników to więcej zadań w każdej rundzie,
- **naprawę muru**: wszystkie części muru wracają do pełnego życia.

## 10 poziomów

<p align="center">
  <img src="screenshots/menu.png" alt="Menu z dziesięcioma poziomami" width="640">
</p>

Każdy wygrany poziom otwiera następny. Wróg z każdym poziomem ma więcej złota i nowe jednostki. Postęp zapisuje się w przeglądarce.

**[Zagraj w Dropithmetic](https://vakrim.github.io/dropithmetic/)** i sprawdź, czy dojdziesz do dziesiątki.

## Sterowanie

| Klawisz       | Co robi                     |
| ------------- | --------------------------- |
| 0–9           | wpisuje odpowiedź           |
| Backspace     | kasuje cyfrę                |
| Enter         | zatwierdza odpowiedź        |
| Esc           | wraca do bitwy albo do menu |

Na tablecie wszystko działa dotykiem.

## Uruchomienie lokalne

```sh
pnpm install
pnpm dev
```
