export class Room {

  constructor(state) {

    this.state =
      state;

    this.clients =
      new Map();

    this.phase =
      "waiting";

    /*
    Level 1 = teks normal.
    Level 2 = teks challenge.
    */
    this.level =
      1;

    this.players =
      new Map();

    this.countdownAt =
      0;

    this.raceAt =
      0;

    this.startTimer =
      null;

    this.joinSequence =
      0;

  }


  async fetch(req) {

    const url =
      new URL(req.url);


    if(

      url.pathname !== "/ws"

      ||

      req.headers.get("Upgrade")
      !==
      "websocket"

    ){

      return new Response(
        "WebSocket endpoint",
        {
          status:400
        }
      );

    }


    const pair =
      new WebSocketPair();


    const [
      client,
      server
    ] =
      Object.values(pair);


    const id =
      crypto.randomUUID();


    server.accept();


    this.clients.set(
      id,
      server
    );


    server.addEventListener(
      "message",
      event => {

        try{

          this.message(

            id,

            JSON.parse(
              event.data ||
              "{}"
            )

          );

        }catch(error){

          console.error(
            "Invalid websocket message",
            error
          );

        }

      }
    );


    server.addEventListener(
      "close",
      () => {

        this.clients.delete(
          id
        );

        this.players.delete(
          id
        );

        this.broadcastState();

      }
    );


    server.addEventListener(
      "error",
      () => {

        this.clients.delete(
          id
        );

        this.players.delete(
          id
        );

        this.broadcastState();

      }
    );


    return new Response(

      null,

      {
        status:101,
        webSocket:client
      }

    );

  }


  publicPlayers(){

    return [
      ...this.players.values()
    ]
    .filter(
      player =>
        player.role ===
        "player"
    );

  }


  message(
    id,
    message
  ){


    /* =====================
       JOIN
    ===================== */

    if(
      message.type ===
      "hello"
    ){

      const role =

        message.role ===
        "server"

          ? "server"

          : "player";


      this.joinSequence +=
        1;


      this.players.set(

        id,

        {

          id,

          role,

          name:
            String(

              message.name ||

              (
                role === "server"

                  ? "SERVER"

                  : "Peserta"
              )

            )
            .slice(
              0,
              20
            ),

          emoji:

            message.emoji ||

            (
              role === "server"

                ? "🏁"

                : "😀"
            ),

          joinOrder:
            this.joinSequence,

          progress:0,

          correct:0,

          typed:0,

          typo:0,

          wpm:0,

          acc:100,

          done:false,

          time:0,

          rank:null

        }

      );


      this.send(

        id,

        {
          type:"hello",
          id
        }

      );


      this.broadcastState();


      return;

    }


    const actor =
      this.players.get(id);


    if(!actor){

      return;

    }


    /* =====================
       START RACE
    ===================== */

    if(
      message.type ===
      "start"
    ){

      if(

        actor.role !==
        "server"

        ||

        this.phase !==
        "waiting"

      ){

        return;

      }


      if(
        this.publicPlayers()
          .length < 1
      ){

        return;

      }


      if(
        this.startTimer
      ){

        clearTimeout(
          this.startTimer
        );

      }


      /*
      Reset score semua peserta.
      */

      for(
        const player
        of
        this.publicPlayers()
      ){

        Object.assign(

          player,

          {

            progress:0,

            correct:0,

            typed:0,

            typo:0,

            wpm:0,

            acc:100,

            done:false,

            time:0,

            rank:null

          }

        );

      }


      /*
      Countdown:
      3 = 1.6 detik
      2 = 1.6 detik
      1 = 1.6 detik
      GO = 1 detik
      */

      const COUNT_STEP_MS =
        1600;

      const GO_MS =
        1000;


      this.phase =
        "countdown";


      this.countdownAt =

        Date.now() +
        350;


      this.raceAt =

        this.countdownAt +

        (
          COUNT_STEP_MS *
          3
        )

        +

        GO_MS;


      this.broadcast({

        type:
          "countdown",

        countdownAt:
          this.countdownAt,

        raceAt:
          this.raceAt,

        level:
          this.level

      });


      this.broadcastState();


      this.startTimer =

        setTimeout(

          () => {

            if(
              this.phase !==
              "countdown"
            ){

              return;

            }


            this.phase =
              "race";


            this.broadcast({

              type:
                "race",

              raceAt:
                this.raceAt,

              level:
                this.level

            });


            this.broadcastState();

          },

          Math.max(

            0,

            this.raceAt -
            Date.now()

          )

        );


      return;

    }


    /* =====================
       PROGRESS
    ===================== */

    if(
      message.type ===
      "progress"
    ){

      const player =
        this.players.get(id);


      if(

        !player

        ||

        player.role !==
        "player"

        ||

        this.phase !==
        "race"

        ||

        player.done

      ){

        return;

      }


      Object.assign(

        player,

        {

          progress:
            Math.max(

              0,

              Math.min(

                1,

                Number(
                  message.progress
                ) || 0

              )

            ),

          correct:
            Math.max(

              0,

              Number(
                message.correct
              ) || 0

            ),

          typed:
            Math.max(

              0,

              Number(
                message.typed
              ) || 0

            ),

          /*
          Typo tidak pernah turun.
          */

          typo:
            Math.max(

              player.typo ||
              0,

              Number(
                message.typo
              ) || 0

            ),

          wpm:
            Math.max(

              0,

              Number(
                message.wpm
              ) || 0

            ),

          acc:
            Math.max(

              0,

              Math.min(

                100,

                Number(
                  message.acc
                ) || 0

              )

            )

        }

      );


      this.broadcast({

        type:"progress",

        id,

        ...player

      });


      return;

    }


    /* =====================
       PLAYER FINISH
    ===================== */

    if(
      message.type ===
      "finish"
    ){

      const player =
        this.players.get(id);


      if(

        !player

        ||

        player.role !==
        "player"

        ||

        this.phase !==
        "race"

        ||

        player.done

      ){

        return;

      }


      Object.assign(

        player,

        {

          progress:1,

          done:true,

          time:
            Math.max(

              0,

              Number(
                message.time
              ) || 0

            ),

          wpm:
            Math.max(

              0,

              Number(
                message.wpm
              ) || 0

            ),

          acc:
            Math.max(

              0,

              Math.min(

                100,

                Number(
                  message.acc
                ) || 0

              )

            ),

          typo:
            Math.max(

              player.typo ||
              0,

              Number(
                message.typo
              ) || 0

            )

        }

      );


      this.broadcast({

        type:"progress",

        id,

        ...player

      });


      const racers =
        this.publicPlayers();


      /*
      Semua selesai =
      otomatis result.
      */

      if(

        racers.length

        &&

        racers.every(
          player =>
            player.done
        )

      ){

        this.finishRace();

      }


      return;

    }


    /* =====================
       SERVER FORCE FINISH
    ===================== */

    if(
      message.type ===
      "finishRace"
    ){

      if(

        actor.role !==
        "server"

        ||

        this.phase !==
        "race"

      ){

        return;

      }


      this.finishRace();


      return;

    }


    /* =====================
       NEW RACE
       NEXT LEVEL
    ===================== */

    if(
      message.type ===
      "newRace"
    ){

      if(
        actor.role !==
        "server"
      ){

        return;

      }


      if(
        this.startTimer
      ){

        clearTimeout(
          this.startTimer
        );

      }


      this.startTimer =
        null;


      /*
      NEW RACE =
      LEVEL 2.
      */

      this.level =
        2;


      this.phase =
        "waiting";


      this.countdownAt =
        0;


      this.raceAt =
        0;


      for(
        const player
        of
        this.publicPlayers()
      ){

        Object.assign(

          player,

          {

            progress:0,

            correct:0,

            typed:0,

            typo:0,

            wpm:0,

            acc:100,

            done:false,

            time:0,

            rank:null

          }

        );

      }


      /*
      Semua player otomatis
      kembali waiting room.
      */

      this.broadcastState();

    }

  }


  /* =====================
     RESULT
  ===================== */

  finishRace(){

    if(
      this.startTimer
    ){

      clearTimeout(
        this.startTimer
      );

    }


    this.startTimer =
      null;


    this.phase =
      "result";


    const racers =
      this.publicPlayers();


    /*
    Yang finish:
    ranking berdasarkan waktu.
    */

    const finished =

      racers

        .filter(
          player =>
            player.done
        )

        .sort(
          (a,b) =>

            (
              a.time -
              b.time
            )

            ||

            (
              b.wpm -
              a.wpm
            )

            ||

            (
              a.typo -
              b.typo
            )

            ||

            (
              a.joinOrder -
              b.joinOrder
            )
        );


    /*
    Yang belum finish
    tetap ditaruh setelah
    peserta finish.
    */

    const unfinished =

      racers

        .filter(
          player =>
            !player.done
        )

        .sort(
          (a,b) =>
            a.joinOrder -
            b.joinOrder
        );


    finished.forEach(
      (player,index) => {

        player.rank =
          index + 1;

      }
    );


    unfinished.forEach(
      (player,index) => {

        player.rank =

          finished.length +

          index +

          1;

      }
    );


    /*
    Peserta DNF nanti
    indikator WPM / typo /
    time tampil "-".
    */

    this.broadcast({

      type:"result",

      players:
        racers,

      level:
        this.level

    });

  }


  /* =====================
     SEND
  ===================== */

  send(
    id,
    message
  ){

    const socket =
      this.clients.get(id);


    if(!socket){

      return;

    }


    try{

      socket.send(
        JSON.stringify(
          message
        )
      );

    }catch(error){

      console.error(
        "WebSocket send failed",
        error
      );

    }

  }


  /* =====================
     BROADCAST
  ===================== */

  broadcast(message){

    const payload =
      JSON.stringify(
        message
      );


    for(
      const socket
      of
      this.clients.values()
    ){

      try{

        socket.send(
          payload
        );

      }catch(error){

        console.error(
          "WebSocket broadcast failed",
          error
        );

      }

    }

  }


  /* =====================
     STATE
  ===================== */

  broadcastState(){

    this.broadcast({

      type:"state",

      phase:
        this.phase,

      level:
        this.level,

      countdownAt:
        this.countdownAt,

      raceAt:
        this.raceAt,

      players:
        this.publicPlayers()

    });

  }

}


/* =========================
   CLOUDFLARE WORKER
========================= */

export default {

  async fetch(
    req,
    env
  ){

    const url =
      new URL(req.url);


    /*
    WebSocket Multiplayer
    */

    if(
      url.pathname ===
      "/ws"
    ){

      const room =
        url.searchParams
          .get("room");


      if(!room){

        return new Response(

          "room required",

          {
            status:400
          }

        );

      }


      const id =
        env.ROOM
          .idFromName(
            room
          );


      return env.ROOM
        .get(id)
        .fetch(req);

    }


    /*
    Static Assets
    */

    return env.ASSETS
      .fetch(req);

  }

};
