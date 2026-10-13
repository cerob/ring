/*  Feedback Ring Generator (Browser Version)

    A feedback ring is an ordered list of team members. Each person gives
    feedback to the next one, and the last person gives feedback to the first.

        [alice, bob, carol]  means  alice -> bob -> carol -> alice

    The generator never reuses a Giver -> Receiver pair that already happened
    in a past session (within the configured history window).

    Usage (from JS):
        set_team([alice, bob, carol, dave]).
        random_feedback_ring(R).
        all_rings(Rs).
*/

:- use_module(library(lists)).
:- use_module(library(random)).
:- use_module(library(aggregate)).

:- dynamic team_member/1.
:- dynamic past_ring/2.

/* ---------------- Configuration ---------------- */

% symmetric(true):  if A gave feedback to B, then B -> A is also blocked.
% symmetric(false): only the exact direction A -> B is blocked.
symmetric(false).

% How many recent sessions count as "past". Use `all` for full history.
history_window(all).

/* ---------------- Team Management ---------------- */

% Set team from JS - clears old members, asserts new ones
set_team(Members) :-
    retractall(team_member(_)),
    forall(member(M, Members), assertz(team_member(M))).

clear_history :-
    retractall(past_ring(_, _)).

team(Members) :-
    findall(M, team_member(M), Members),
    length(Members, N),
    N >= 2.

/* ---------------- Ring basics ---------------- */

% ring_pair(+Ring, ?Giver, ?Receiver): pairs in a ring, including last -> first.
ring_pair(Ring, Giver, Receiver) :-
    Ring = [First|_],
    append(Ring, [First], Closed),
    nextto(Giver, Receiver, Closed).

/* ---------------- History rules ---------------- */

counted_ring(Ring) :-
    history_window(all), !,
    past_ring(_, Ring).
counted_ring(Ring) :-
    history_window(K),
    integer(K), K > 0,
    findall(Id, past_ring(Id, _), Ids),
    sort(0, @>=, Ids, Desc),
    (   length(Desc, Len), Len =< K
    ->  Recent = Desc
    ;   length(Recent, K),
        append(Recent, _, Desc)
    ),
    member(Id, Recent),
    past_ring(Id, Ring).

past_pair(G, R) :-
    counted_ring(Ring),
    ring_pair(Ring, G, R).

blocked(G, R) :- past_pair(G, R).
blocked(G, R) :- symmetric(true), past_pair(R, G).

allowed(G, R) :-
    G \== R,
    \+ blocked(G, R).

/* ---------------- Ring generation ---------------- */

% build(+Current, +Remaining, +First, -Path)
build(Current, [], First, []) :-
    allowed(Current, First).
build(Current, Remaining, First, [Next|Path]) :-
    select(Next, Remaining, Others),
    allowed(Current, Next),
    build(Next, Others, First, Path).

% All valid rings, first member fixed to avoid rotational duplicates
feedback_ring(Ring) :-
    team([First|Rest]),
    build(First, Rest, First, Path),
    Ring = [First|Path].

all_rings(Rings) :-
    findall(R, feedback_ring(R), Rings).

% Random valid ring
random_feedback_ring(Ring) :-
    team(Members),
    random_permutation(Members, [First|Rest]),
    once(build(First, Rest, First, Path)),
    Ring = [First|Path].

/* ---------------- Session Recording ---------------- */

record_ring(Ring) :-
    (   aggregate_all(max(I), past_ring(I, _), Max)
    ->  Id is Max + 1
    ;   Id = 1
    ),
    assertz(past_ring(Id, Ring)).

get_history(History) :-
    findall(ring(Id, Ring), past_ring(Id, Ring), History).
