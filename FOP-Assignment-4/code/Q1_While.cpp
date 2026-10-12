/*
 * Assignment 4 - Question 1 (while version)
 * Author  : Ahmed Mohamed Fathi (F25SP2826), Section 31
 * Purpose : Display the sentence "I Love Programming" 30 times
 *           using a while loop.
 */
#include <iostream>
using namespace std;

int main()
{
    const int TIMES = 30;   // number of times to display the sentence
    int count = 1;          // loop counter

    // while: the condition is checked before each repetition
    while (count <= TIMES)
    {
        cout << "I Love Programming" << endl;
        count++;
    }

    return 0;
}
