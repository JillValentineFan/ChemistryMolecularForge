/*
 * Assignment 4 - Question 2 (while version)
 * Purpose : Display the sentence "I Love Programming" X times,
 *           where X is entered by the user, using a while loop.
 */
#include <iostream>
using namespace std;

int main()
{
    int x;          // number of times, entered by the user
    int count = 1;  // loop counter

    cout << "How many times to display the sentence? ";
    cin >> x;
    cout << endl;

    // while: the condition is checked before each repetition
    while (count <= x)
    {
        cout << "I Love Programming" << endl;
        count++;
    }

    return 0;
}
